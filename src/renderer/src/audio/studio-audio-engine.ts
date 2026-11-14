import { scaleNoteToFrequencyHz } from '@shared/music/chromatic';
import type {
  GuideAudioMode,
  LiveAudioTelemetry,
  ReferenceToneRequest,
  SampleRateHz,
  ScaleNote
} from '@shared/types';
import {
  downsampleWaveformSlice,
  estimateVocalPitch,
  computeVocalSpectrum64
} from './dsp-analysis';
import { synthesizePitchedMetronomeBuffer } from './guide-synth';
import {
  CLIPPING_THRESHOLD_DBFS,
  MIN_DBFS,
  amplitudeToDbfs,
  decodeWavBytes
} from './wav-codec';
import {
  CAPTURE_WORKLET_NAME,
  WORKLET_CHUNK_SIZE,
  type WorkletInboundMessage,
  type WorkletOutboundMessage,
  createCaptureWorkletBlobUrl,
  revokeCaptureWorkletBlobUrl
} from './worklet-processor-source';

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId: string;
  isDefault: boolean;
}

export interface EnumeratedAudioDevices {
  inputs: AudioDeviceOption[];
  outputs: AudioDeviceOption[];
}

export interface StartRecordingOptions {
  inputDeviceId?: string;
  outputDeviceId?: string;
  sampleRate: SampleRateHz;
  targetNote: ScaleNote;
  guideAudio: GuideAudioMode;
  customGuideWavBytes?: Uint8Array;
  onTelemetry: (frame: LiveAudioTelemetry) => void;
}

export interface StopRecordingResult {
  samples: Float32Array;
  sampleRate: number;
}

export interface PlayBufferParams {
  samples: Float32Array;
  sampleRate: number;
  outputDeviceId?: string;
  onProgress?: (positionMs: number) => void;
  onEnded?: () => void;
}

export interface MicMonitorOptions {
  inputDeviceId?: string;
  outputDeviceId?: string;
  loopback: boolean;
  onLevel: (rmsDb: number, peakDb: number, clipped: boolean) => void;
}

export interface StudioAudioEngineDeps {
  createAudioContext?: (options?: AudioContextOptions) => AudioContext;
  createWorkletNode?: (
    context: AudioContext,
    processorName: string
  ) => AudioWorkletNode;
  mediaDevices?: Pick<
    MediaDevices,
    'enumerateDevices' | 'getUserMedia' | 'addEventListener' | 'removeEventListener'
  >;
}

interface AudioContextWithSinkId extends AudioContext {
  readonly sinkId?: string;
  setSinkId?: (sinkId: string) => Promise<void>;
}

interface CaptureNodeBridge {
  readonly audioNode: AudioNode;
  setOnMessage(
    handler: ((event: MessageEvent<WorkletOutboundMessage>) => void) | null
  ): void;
  postMessage(message: WorkletInboundMessage): void;
  disconnect(): void;
}

interface ActiveRecordingSession {
  context: AudioContext;
  stream: MediaStream;
  sourceNode: MediaStreamAudioSourceNode;
  captureBridge: CaptureNodeBridge;
  monitorGainNode: GainNode;
  guideSourceNode: AudioBufferSourceNode | null;
  sampleRate: number;
  chunks: Float32Array[];
  totalSamples: number;
  stoppedPromise: Promise<void>;
  resolveStopped: () => void;
}

interface ActivePlaybackSession {
  context: AudioContext;
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  manuallyStopped: boolean;
  cancelProgressTimer: () => void;
}

interface ActiveReferenceToneSession {
  context: AudioContext;
  oscillators: OscillatorNode[];
  harmonicGains: GainNode[];
  envelopeGain: GainNode;
  cleanupTimeoutId: ReturnType<typeof setTimeout> | null;
}

interface ActiveMicMonitorSession {
  context: AudioContext;
  stream: MediaStream;
  sourceNode: MediaStreamAudioSourceNode;
  captureBridge: CaptureNodeBridge;
  loopbackGainNode: GainNode;
}

const ANALYSIS_WINDOW_SIZE = 2048;
const OSCILLOSCOPE_SLICE_POINTS = 256;
const RECORDING_LOOKAHEAD_SEC = 0.01;
const ADSR_ATTACK_SEC = 0.015;
const ADSR_DECAY_SEC = 0.06;
const ADSR_SUSTAIN_LEVEL = 0.82;
const ADSR_RELEASE_SEC = 0.015;

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeChunkLevels(chunk: Float32Array): {
  rmsDb: number;
  peakDb: number;
  clipped: boolean;
} {
  const length = chunk.length;
  if (length === 0) {
    return { rmsDb: MIN_DBFS, peakDb: MIN_DBFS, clipped: false };
  }
  let sumSquares = 0;
  let peakAmp = 0;
  for (let i = 0; i < length; i++) {
    const raw = chunk[i] ?? 0;
    const sample = Number.isFinite(raw) ? raw : 0;
    sumSquares += sample * sample;
    const abs = Math.abs(sample);
    if (abs > peakAmp) {
      peakAmp = abs;
    }
  }
  const rmsAmp = Math.sqrt(sumSquares / length);
  const rmsDb = amplitudeToDbfs(rmsAmp);
  const rawPeakDb = peakAmp > 0 ? 20 * Math.log10(peakAmp) : -Infinity;
  const peakDb = amplitudeToDbfs(peakAmp);
  const clipped = rawPeakDb >= CLIPPING_THRESHOLD_DBFS;
  return { rmsDb, peakDb, clipped };
}

function stopMediaStreamTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Ignore already-stopped tracks
    }
  }
}

/**
 * WebAudio Studio Engine for `aie` v1:
 * - Audio I/O enumeration + hot-plug `devicechange` subscriptions + `AudioContext.setSinkId` routing
 * - Sample-clock-locked `AudioWorklet` capture + synchronized guide audio (`AudioBufferSourceNode`)
 * - 0-click ADSR harmonic reference scale synth (`S` key & Set Audition)
 * - In-memory `Float32Array` take playback with 60 fps cursor progress
 * - Live Settings Mic Check level monitor with optional low-latency hardware loopback
 */
export class StudioAudioEngine {
  private readonly deps: StudioAudioEngineDeps;
  private sharedContext: AudioContext | null = null;
  private readonly registeredWorkletContexts = new WeakSet<AudioContext>();
  private readonly deviceUnsubscribers = new Set<() => void>();

  private recordingSession: ActiveRecordingSession | null = null;
  private playbackSession: ActivePlaybackSession | null = null;
  private referenceToneSession: ActiveReferenceToneSession | null = null;
  private micMonitorSession: ActiveMicMonitorSession | null = null;

  constructor(deps: StudioAudioEngineDeps = {}) {
    this.deps = deps;
  }

  private getMediaDevices():
    | Pick<
        MediaDevices,
        | 'enumerateDevices'
        | 'getUserMedia'
        | 'addEventListener'
        | 'removeEventListener'
      >
    | undefined {
    return this.deps.mediaDevices ?? globalThis.navigator?.mediaDevices;
  }

  private createContext(options?: AudioContextOptions): AudioContext {
    if (this.deps.createAudioContext) {
      return this.deps.createAudioContext(options);
    }
    const Ctor =
      globalThis.AudioContext ??
      (
        globalThis as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!Ctor) {
      throw new Error('WebAudio AudioContext is not available in this runtime.');
    }
    return new Ctor(options);
  }

  private instantiateWorkletNode(context: AudioContext): AudioWorkletNode {
    if (this.deps.createWorkletNode) {
      return this.deps.createWorkletNode(context, CAPTURE_WORKLET_NAME);
    }
    return new AudioWorkletNode(context, CAPTURE_WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });
  }

  private async ensureContext(
    preferredSampleRate?: number,
    outputDeviceId?: string
  ): Promise<AudioContext> {
    if (
      this.sharedContext &&
      this.sharedContext.state !== 'closed' &&
      (preferredSampleRate === undefined ||
        this.sharedContext.sampleRate === preferredSampleRate)
    ) {
      await this.applyOutputSink(this.sharedContext, outputDeviceId);
      if (this.sharedContext.state === 'suspended') {
        await this.sharedContext.resume();
      }
      return this.sharedContext;
    }

    if (this.sharedContext && this.sharedContext.state !== 'closed') {
      try {
        await this.sharedContext.close();
      } catch {
        // Ignore close errors when switching sample rate
      }
    }

    const contextOptions: AudioContextOptions = {
      latencyHint: 'interactive'
    };
    if (preferredSampleRate !== undefined && preferredSampleRate > 0) {
      contextOptions.sampleRate = preferredSampleRate;
    }

    const context = this.createContext(contextOptions);
    this.sharedContext = context;
    await this.applyOutputSink(context, outputDeviceId);
    if (context.state === 'suspended') {
      await context.resume();
    }
    return context;
  }

  private async applyOutputSink(
    context: AudioContext,
    outputDeviceId?: string
  ): Promise<void> {
    const sinkCapable = context as AudioContextWithSinkId;
    if (typeof sinkCapable.setSinkId !== 'function') {
      return;
    }

    const normalizedSinkId =
      !outputDeviceId || outputDeviceId === 'default' ? '' : outputDeviceId;
    if ((sinkCapable.sinkId ?? '') === normalizedSinkId) {
      return;
    }

    try {
      await sinkCapable.setSinkId(normalizedSinkId);
    } catch {
      // If a saved external USB audio interface was unplugged, fall back cleanly to system default
      if (normalizedSinkId !== '') {
        try {
          await sinkCapable.setSinkId('');
        } catch {
          // Ignore fallback errors
        }
      }
    }
  }

  private async ensureCaptureWorkletLoaded(
    context: AudioContext
  ): Promise<boolean> {
    if (this.registeredWorkletContexts.has(context)) {
      return true;
    }
    if (!context.audioWorklet || typeof context.audioWorklet.addModule !== 'function') {
      if (this.deps.createWorkletNode) {
        this.registeredWorkletContexts.add(context);
        return true;
      }
      return false;
    }

    const blobUrl = createCaptureWorkletBlobUrl();
    try {
      await context.audioWorklet.addModule(blobUrl);
      this.registeredWorkletContexts.add(context);
      return true;
    } catch {
      // If renderer CSP (`script-src 'self'`) blocks `blob:` AudioWorklet modules,
      // fall back cleanly to our sample-clock-gated ScriptProcessorNode bridge.
      return false;
    } finally {
      revokeCaptureWorkletBlobUrl(blobUrl);
    }
  }

  private createScriptProcessorCaptureBridge(
    context: AudioContext
  ): CaptureNodeBridge {
    if (typeof context.createScriptProcessor !== 'function') {
      throw new Error(
        'Neither AudioWorklet nor ScriptProcessorNode is available on this AudioContext.'
      );
    }

    const processor = context.createScriptProcessor(1024, 1, 1);
    let onMessageHandler:
      | ((event: MessageEvent<WorkletOutboundMessage>) => void)
      | null = null;
    let active = false;
    let alive = true;
    let startAtTime = 0;
    let buffer = new Float32Array(WORKLET_CHUNK_SIZE);
    let writeIndex = 0;

    const emitMessage = (data: WorkletOutboundMessage): void => {
      onMessageHandler?.({ data } as MessageEvent<WorkletOutboundMessage>);
    };

    const flush = (): void => {
      if (writeIndex > 0) {
        const remainder = buffer.slice(0, writeIndex);
        emitMessage({ type: 'chunk', samples: remainder });
        buffer = new Float32Array(WORKLET_CHUNK_SIZE);
        writeIndex = 0;
      }
    };

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!alive) {
        return;
      }
      const inputBuffer = event.inputBuffer;
      const outputBuffer = event.outputBuffer;
      const channelCount = inputBuffer.numberOfChannels;
      const frameCount = inputBuffer.length;

      for (let ch = 0; ch < outputBuffer.numberOfChannels; ch++) {
        const outCh = outputBuffer.getChannelData(ch);
        if (channelCount > 0) {
          const srcCh = inputBuffer.getChannelData(
            Math.min(ch, channelCount - 1)
          );
          outCh.set(srcCh);
        } else {
          outCh.fill(0);
        }
      }

      if (!active) {
        return;
      }

      const sr = inputBuffer.sampleRate || context.sampleRate || 48000;
      const blockDuration = frameCount / sr;
      // playbackTime is the end of the output buffer; input block starts one buffer earlier
      const blockStartSec =
        typeof event.playbackTime === 'number'
          ? Math.max(0, event.playbackTime - blockDuration)
          : context.currentTime;

      if (blockStartSec + blockDuration <= startAtTime) {
        return;
      }

      let startOffset = 0;
      if (blockStartSec < startAtTime) {
        startOffset = Math.max(
          0,
          Math.min(
            frameCount,
            Math.round((startAtTime - blockStartSec) * sr)
          )
        );
      }

      const ch0 = channelCount > 0 ? inputBuffer.getChannelData(0) : null;
      for (let i = startOffset; i < frameCount; i++) {
        let monoSample = 0;
        if (channelCount === 1 && ch0) {
          monoSample = ch0[i] ?? 0;
        } else if (channelCount > 1) {
          for (let ch = 0; ch < channelCount; ch++) {
            monoSample += inputBuffer.getChannelData(ch)[i] ?? 0;
          }
          monoSample /= channelCount;
        }

        buffer[writeIndex++] = monoSample;
        if (writeIndex >= WORKLET_CHUNK_SIZE) {
          const fullChunk = buffer;
          emitMessage({ type: 'chunk', samples: fullChunk });
          buffer = new Float32Array(WORKLET_CHUNK_SIZE);
          writeIndex = 0;
        }
      }
    };

    return {
      audioNode: processor,
      setOnMessage(handler) {
        onMessageHandler = handler;
      },
      postMessage(msg) {
        if (msg.type === 'start') {
          startAtTime = msg.startAtTime;
          writeIndex = 0;
          active = true;
        } else if (msg.type === 'stop') {
          if (active) {
            flush();
            active = false;
          }
          emitMessage({ type: 'stopped' });
        } else if (msg.type === 'dispose') {
          if (active) {
            flush();
            active = false;
          }
          alive = false;
          processor.onaudioprocess = null;
        }
      },
      disconnect() {
        processor.onaudioprocess = null;
        processor.disconnect();
      }
    };
  }

  private async createCaptureBridge(
    context: AudioContext
  ): Promise<CaptureNodeBridge> {
    const workletReady = await this.ensureCaptureWorkletLoaded(context);
    if (workletReady) {
      const workletNode = this.instantiateWorkletNode(context);
      return {
        audioNode: workletNode,
        setOnMessage(handler) {
          workletNode.port.onmessage = handler;
        },
        postMessage(msg) {
          workletNode.port.postMessage(msg);
        },
        disconnect() {
          workletNode.port.onmessage = null;
          workletNode.disconnect();
        }
      };
    }
    return this.createScriptProcessorCaptureBridge(context);
  }

  private async acquireDryMicStream(
    inputDeviceId: string | undefined,
    sampleRate?: number
  ): Promise<MediaStream> {
    const mediaDevices = this.getMediaDevices();
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      throw new Error('navigator.mediaDevices.getUserMedia is not available.');
    }

    const baseAudioConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 1 }
    };
    if (sampleRate !== undefined && sampleRate > 0) {
      baseAudioConstraints.sampleRate = { ideal: sampleRate };
    }

    const hasSpecificDevice =
      Boolean(inputDeviceId) && inputDeviceId !== 'default';

    if (hasSpecificDevice) {
      try {
        return await mediaDevices.getUserMedia({
          audio: {
            ...baseAudioConstraints,
            deviceId: { exact: inputDeviceId }
          },
          video: false
        });
      } catch {
        // Saved mic device may have been unplugged; retry with ideal fallback
        return await mediaDevices.getUserMedia({
          audio: {
            ...baseAudioConstraints,
            deviceId: { ideal: inputDeviceId }
          },
          video: false
        });
      }
    }

    return await mediaDevices.getUserMedia({
      audio: baseAudioConstraints,
      video: false
    });
  }

  private async prepareGuideAudioBuffer(
    context: AudioContext,
    guideAudio: GuideAudioMode,
    targetNote: ScaleNote,
    customGuideWavBytes?: Uint8Array
  ): Promise<AudioBuffer | null> {
    if (guideAudio.kind === 'none') {
      return null;
    }

    if (guideAudio.kind === 'pitched-metronome') {
      const synthSamples = synthesizePitchedMetronomeBuffer({
        sampleRate: context.sampleRate,
        bpm: guideAudio.bpm,
        leadInBeats: guideAudio.leadInBeats,
        moraCount: guideAudio.moraCount,
        targetNote
      });
      if (synthSamples.length === 0) {
        return null;
      }
      const audioBuffer = context.createBuffer(
        1,
        synthSamples.length,
        context.sampleRate
      );
      audioBuffer.getChannelData(0).set(synthSamples);
      return audioBuffer;
    }

    if (
      guideAudio.kind === 'custom-file' &&
      customGuideWavBytes &&
      customGuideWavBytes.byteLength > 0
    ) {
      // First try native Chromium decodeAudioData (supports WAV, MP3, OGG, FLAC, M4A)
      if (typeof context.decodeAudioData === 'function') {
        try {
          const detachedCopy = new ArrayBuffer(customGuideWavBytes.byteLength);
          new Uint8Array(detachedCopy).set(customGuideWavBytes);
          return await context.decodeAudioData(detachedCopy);
        } catch {
          // Fall back to pure-TS WAV decoder below (handles 24-bit/RF64 or test environments)
        }
      }

      const decoded = decodeWavBytes(customGuideWavBytes);
      if (decoded.samples.length === 0) {
        return null;
      }
      const audioBuffer = context.createBuffer(
        1,
        decoded.samples.length,
        decoded.sampleRate
      );
      audioBuffer.getChannelData(0).set(decoded.samples);
      return audioBuffer;
    }

    return null;
  }

  /**
   * Enumerates available audio input and output devices.
   */
  async enumerateAudioDevices(): Promise<EnumeratedAudioDevices> {
    const mediaDevices = this.getMediaDevices();
    if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') {
      return { inputs: [], outputs: [] };
    }

    const rawDevices = await mediaDevices.enumerateDevices();
    const inputs: AudioDeviceOption[] = [];
    const outputs: AudioDeviceOption[] = [];

    for (const device of rawDevices) {
      if (device.kind === 'audioinput') {
        const index = inputs.length + 1;
        inputs.push({
          deviceId: device.deviceId,
          label: device.label.trim() || `Microphone ${index}`,
          kind: 'audioinput',
          groupId: device.groupId ?? '',
          isDefault: device.deviceId === 'default' || inputs.length === 0
        });
      } else if (device.kind === 'audiooutput') {
        const index = outputs.length + 1;
        outputs.push({
          deviceId: device.deviceId,
          label: device.label.trim() || `Audio Output ${index}`,
          kind: 'audiooutput',
          groupId: device.groupId ?? '',
          isDefault: device.deviceId === 'default' || outputs.length === 0
        });
      }
    }

    return { inputs, outputs };
  }

  /**
   * Subscribes to `navigator.mediaDevices` hot-plug `devicechange` events and emits refreshed device lists.
   */
  subscribeDeviceChanges(
    listener: (devices: EnumeratedAudioDevices) => void
  ): () => void {
    const mediaDevices = this.getMediaDevices();
    if (
      !mediaDevices ||
      typeof mediaDevices.addEventListener !== 'function' ||
      typeof mediaDevices.removeEventListener !== 'function'
    ) {
      return () => undefined;
    }

    let disposed = false;
    const handleChange = (): void => {
      void this.enumerateAudioDevices()
        .then((devices) => {
          if (!disposed) {
            listener(devices);
          }
        })
        .catch(() => {
          // Ignore transient enumeration failures during USB device reset
        });
    };

    mediaDevices.addEventListener('devicechange', handleChange);
    const unsubscribe = (): void => {
      if (disposed) {
        return;
      }
      disposed = true;
      mediaDevices.removeEventListener('devicechange', handleChange);
      this.deviceUnsubscribers.delete(unsubscribe);
    };

    this.deviceUnsubscribers.add(unsubscribe);
    return unsubscribe;
  }

  get isRecording(): boolean {
    return this.recordingSession !== null;
  }

  get isPlaying(): boolean {
    return this.playbackSession !== null;
  }

  /**
   * Starts sample-clock-locked recording: any pitched metronome or custom guide `AudioBufferSourceNode`
   * starts on the exact same `AudioContext.currentTime` timestamp as the `AudioWorklet` capture gate.
   */
  async startRecording(options: StartRecordingOptions): Promise<void> {
    if (this.recordingSession) {
      await this.stopRecording();
    }
    this.stopPlayback();
    this.stopReferenceTone();
    this.stopMicMonitor();

    const context = await this.ensureContext(
      options.sampleRate,
      options.outputDeviceId
    );
    const captureBridge = await this.createCaptureBridge(context);

    const stream = await this.acquireDryMicStream(
      options.inputDeviceId,
      options.sampleRate
    );

    let guideBuffer: AudioBuffer | null = null;
    try {
      guideBuffer = await this.prepareGuideAudioBuffer(
        context,
        options.guideAudio,
        options.targetNote,
        options.customGuideWavBytes
      );
    } catch (error) {
      captureBridge.disconnect();
      stopMediaStreamTracks(stream);
      throw error;
    }

    const sourceNode = context.createMediaStreamSource(stream);
    const monitorGainNode = context.createGain();
    monitorGainNode.gain.value = 0;

    sourceNode.connect(captureBridge.audioNode);
    captureBridge.audioNode.connect(monitorGainNode);
    monitorGainNode.connect(context.destination);

    let resolveStopped: () => void = () => undefined;
    const stoppedPromise = new Promise<void>((resolve) => {
      resolveStopped = resolve;
    });

    const analysisWindow = new Float32Array(ANALYSIS_WINDOW_SIZE);
    let analysisFilled = 0;

    const session: ActiveRecordingSession = {
      context,
      stream,
      sourceNode,
      captureBridge,
      monitorGainNode,
      guideSourceNode: null,
      sampleRate: context.sampleRate,
      chunks: [],
      totalSamples: 0,
      stoppedPromise,
      resolveStopped
    };

    captureBridge.setOnMessage((event: MessageEvent<WorkletOutboundMessage>) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') {
        return;
      }

      if (msg.type === 'chunk') {
        const chunk =
          msg.samples instanceof Float32Array
            ? msg.samples
            : new Float32Array(msg.samples);
        if (chunk.length === 0) {
          return;
        }

        session.chunks.push(chunk);
        session.totalSamples += chunk.length;

        if (chunk.length >= ANALYSIS_WINDOW_SIZE) {
          analysisWindow.set(
            chunk.subarray(chunk.length - ANALYSIS_WINDOW_SIZE)
          );
          analysisFilled = ANALYSIS_WINDOW_SIZE;
        } else {
          analysisWindow.copyWithin(0, chunk.length);
          analysisWindow.set(chunk, ANALYSIS_WINDOW_SIZE - chunk.length);
          analysisFilled = Math.min(
            ANALYSIS_WINDOW_SIZE,
            analysisFilled + chunk.length
          );
        }

        const { rmsDb, peakDb, clipped } = computeChunkLevels(chunk);
        const pitchFrame =
          analysisFilled >= ANALYSIS_WINDOW_SIZE
            ? analysisWindow
            : analysisWindow.subarray(ANALYSIS_WINDOW_SIZE - analysisFilled);

        const pitch = estimateVocalPitch(
          pitchFrame,
          session.sampleRate,
          options.targetNote
        );
        const spectrumBands = computeVocalSpectrum64(
          pitchFrame,
          session.sampleRate
        );
        const waveformSlice = downsampleWaveformSlice(
          chunk,
          OSCILLOSCOPE_SLICE_POINTS
        );
        const elapsedMs = (session.totalSamples / session.sampleRate) * 1000;

        options.onTelemetry({
          rmsDb,
          peakDb,
          clipped,
          pitch,
          spectrumBands,
          waveformSlice,
          elapsedMs
        });
      } else if (msg.type === 'stopped') {
        session.resolveStopped();
      }
    });

    const startAtTime = context.currentTime + RECORDING_LOOKAHEAD_SEC;
    captureBridge.postMessage({
      type: 'start',
      startAtTime
    });

    if (guideBuffer) {
      const guideSource = context.createBufferSource();
      guideSource.buffer = guideBuffer;
      guideSource.connect(context.destination);
      guideSource.start(startAtTime);
      session.guideSourceNode = guideSource;
    }

    this.recordingSession = session;
  }

  /**
   * Stops active capture, flushes final AudioWorklet quantum samples, tears down mic stream & guide audio,
   * and returns the contiguous mono `Float32Array` buffer + hardware `sampleRate`.
   */
  async stopRecording(): Promise<StopRecordingResult> {
    const session = this.recordingSession;
    if (!session) {
      return {
        samples: new Float32Array(0),
        sampleRate: this.sharedContext?.sampleRate ?? 44100
      };
    }

    this.recordingSession = null;

    if (session.guideSourceNode) {
      try {
        session.guideSourceNode.stop();
      } catch {
        // Guide buffer may have already finished playing
      }
      try {
        session.guideSourceNode.disconnect();
      } catch {
        // Ignore disconnect error
      }
    }

    try {
      session.captureBridge.postMessage({ type: 'stop' });
      await Promise.race([session.stoppedPromise, waitMs(50)]);
      session.captureBridge.postMessage({ type: 'dispose' });
    } catch {
      // Ignore port teardown errors
    }

    try {
      session.sourceNode.disconnect();
      session.captureBridge.disconnect();
      session.monitorGainNode.disconnect();
    } catch {
      // Ignore node disconnect errors
    }

    stopMediaStreamTracks(session.stream);

    const output = new Float32Array(session.totalSamples);
    let offset = 0;
    for (const chunk of session.chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      samples: output,
      sampleRate: session.sampleRate
    };
  }

  /**
   * Plays an in-memory `Float32Array` take routed to `outputDeviceId`, emitting ~60 fps `onProgress` updates.
   */
  async playBuffer(params: PlayBufferParams): Promise<void> {
    this.stopPlayback();

    if (params.samples.length === 0 || params.sampleRate <= 0) {
      params.onProgress?.(0);
      params.onEnded?.();
      return;
    }

    const context = await this.ensureContext(undefined, params.outputDeviceId);
    const audioBuffer = context.createBuffer(
      1,
      params.samples.length,
      params.sampleRate
    );
    audioBuffer.getChannelData(0).set(params.samples);

    const sourceNode = context.createBufferSource();
    sourceNode.buffer = audioBuffer;
    const gainNode = context.createGain();
    gainNode.gain.value = 1;

    sourceNode.connect(gainNode);
    gainNode.connect(context.destination);

    const durationMs = (params.samples.length / params.sampleRate) * 1000;
    const startedAtContextTime = context.currentTime;

    let rafId: number | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const cancelProgressTimer = (): void => {
      if (rafId !== null && typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const session: ActivePlaybackSession = {
      context,
      sourceNode,
      gainNode,
      manuallyStopped: false,
      cancelProgressTimer
    };
    this.playbackSession = session;

    if (params.onProgress) {
      const emitProgress = (): void => {
        if (this.playbackSession !== session || session.manuallyStopped) {
          return;
        }
        const elapsedMs = Math.max(
          0,
          Math.min(durationMs, (context.currentTime - startedAtContextTime) * 1000)
        );
        params.onProgress?.(elapsedMs);
      };

      if (typeof globalThis.requestAnimationFrame === 'function') {
        const tick = (): void => {
          if (this.playbackSession !== session || session.manuallyStopped) {
            return;
          }
          emitProgress();
          rafId = globalThis.requestAnimationFrame(tick);
        };
        rafId = globalThis.requestAnimationFrame(tick);
      } else {
        intervalId = setInterval(emitProgress, 16);
      }
    }

    sourceNode.onended = () => {
      cancelProgressTimer();
      try {
        sourceNode.disconnect();
        gainNode.disconnect();
      } catch {
        // Ignore disconnect error
      }
      if (this.playbackSession === session) {
        this.playbackSession = null;
      }
      if (!session.manuallyStopped) {
        params.onProgress?.(durationMs);
        params.onEnded?.();
      }
    };

    sourceNode.start(0);
  }

  /**
   * Convenience alias matching `StudioAudioAdapter` naming (`playSamples`).
   */
  async playSamples(params: PlayBufferParams): Promise<void> {
    await this.playBuffer(params);
  }

  /**
   * Stops active buffer playback cleanly without firing natural-end `onEnded` callbacks.
   */
  stopPlayback(): void {
    const session = this.playbackSession;
    if (!session) {
      return;
    }
    this.playbackSession = null;
    session.manuallyStopped = true;
    session.cancelProgressTimer();
    session.sourceNode.onended = null;
    try {
      session.sourceNode.stop();
    } catch {
      // Ignore already-stopped source
    }
    try {
      session.sourceNode.disconnect();
      session.gainNode.disconnect();
    } catch {
      // Ignore disconnect error
    }
  }

  /**
   * Starts a warm, click-free reference pitch synth (`S` key / Audition Pitch):
   * fundamental + gentle 2nd & 3rd harmonics shaped by a 15ms ADSR attack/release envelope.
   */
  async startReferenceTone(
    note: ScaleNote,
    outputDeviceId?: string
  ): Promise<void>;
  async startReferenceTone(request: ReferenceToneRequest): Promise<void>;
  async startReferenceTone(
    noteOrRequest: ScaleNote | ReferenceToneRequest,
    outputDeviceId?: string
  ): Promise<void> {
    this.stopReferenceTone();

    const note =
      typeof noteOrRequest === 'string' ? noteOrRequest : noteOrRequest.note;
    const resolvedOutputDeviceId =
      typeof noteOrRequest === 'string'
        ? outputDeviceId
        : noteOrRequest.outputDeviceId;

    const context = await this.ensureContext(undefined, resolvedOutputDeviceId);
    const fundamentalHz = scaleNoteToFrequencyHz(note);
    const nyquist = context.sampleRate * 0.48;

    const envelopeGain = context.createGain();
    const now = context.currentTime;
    envelopeGain.gain.setValueAtTime(0, now);
    envelopeGain.gain.linearRampToValueAtTime(1, now + ADSR_ATTACK_SEC);
    envelopeGain.gain.linearRampToValueAtTime(
      ADSR_SUSTAIN_LEVEL,
      now + ADSR_ATTACK_SEC + ADSR_DECAY_SEC
    );
    envelopeGain.connect(context.destination);

    const harmonics: Array<{ freqHz: number; gain: number }> = [
      { freqHz: fundamentalHz, gain: 0.22 },
      { freqHz: fundamentalHz * 2, gain: 0.065 },
      { freqHz: fundamentalHz * 3, gain: 0.022 }
    ];

    const oscillators: OscillatorNode[] = [];
    const harmonicGains: GainNode[] = [];

    for (const partial of harmonics) {
      if (partial.freqHz >= nyquist) {
        continue;
      }
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(partial.freqHz, now);

      const partialGain = context.createGain();
      partialGain.gain.setValueAtTime(partial.gain, now);

      osc.connect(partialGain);
      partialGain.connect(envelopeGain);
      osc.start(now);

      oscillators.push(osc);
      harmonicGains.push(partialGain);
    }

    this.referenceToneSession = {
      context,
      oscillators,
      harmonicGains,
      envelopeGain,
      cleanupTimeoutId: null
    };
  }

  /**
   * Releases active reference pitch synth over a smooth 15ms linear ramp so there are zero speaker clicks.
   */
  stopReferenceTone(): void {
    const session = this.referenceToneSession;
    if (!session) {
      return;
    }
    this.referenceToneSession = null;

    if (session.cleanupTimeoutId !== null) {
      clearTimeout(session.cleanupTimeoutId);
    }

    const now = session.context.currentTime;
    try {
      session.envelopeGain.gain.cancelScheduledValues(now);
      session.envelopeGain.gain.setValueAtTime(
        session.envelopeGain.gain.value,
        now
      );
      session.envelopeGain.gain.linearRampToValueAtTime(
        0,
        now + ADSR_RELEASE_SEC
      );
    } catch {
      // Ignore automation errors on mocked/closed AudioParams
    }

    const stopAt = now + ADSR_RELEASE_SEC + 0.005;
    for (const osc of session.oscillators) {
      try {
        osc.stop(stopAt);
      } catch {
        // Ignore stop errors
      }
    }

    session.cleanupTimeoutId = setTimeout(() => {
      for (const osc of session.oscillators) {
        try {
          osc.disconnect();
        } catch {
          // Ignore disconnect error
        }
      }
      for (const g of session.harmonicGains) {
        try {
          g.disconnect();
        } catch {
          // Ignore disconnect error
        }
      }
      try {
        session.envelopeGain.disconnect();
      } catch {
        // Ignore disconnect error
      }
    }, Math.ceil((ADSR_RELEASE_SEC + 0.02) * 1000));
  }

  /**
   * Starts live Settings Modal Mic Check level monitoring (`rmsDb`, `peakDb`, `clipped`)
   * with optional hardware-routed loopback to `outputDeviceId`.
   */
  async startMicMonitor(options: MicMonitorOptions): Promise<void> {
    this.stopMicMonitor();
    if (this.recordingSession) {
      await this.stopRecording();
    }

    const context = await this.ensureContext(undefined, options.outputDeviceId);
    const captureBridge = await this.createCaptureBridge(context);

    const stream = await this.acquireDryMicStream(options.inputDeviceId);
    const sourceNode = context.createMediaStreamSource(stream);
    const loopbackGainNode = context.createGain();
    loopbackGainNode.gain.setValueAtTime(
      options.loopback ? 1 : 0,
      context.currentTime
    );

    sourceNode.connect(captureBridge.audioNode);
    captureBridge.audioNode.connect(loopbackGainNode);
    loopbackGainNode.connect(context.destination);

    captureBridge.setOnMessage(
      (event: MessageEvent<WorkletOutboundMessage>) => {
        const msg = event.data;
        if (!msg || msg.type !== 'chunk') {
          return;
        }
        const chunk =
          msg.samples instanceof Float32Array
            ? msg.samples
            : new Float32Array(msg.samples);
        if (chunk.length === 0) {
          return;
        }
        const { rmsDb, peakDb, clipped } = computeChunkLevels(chunk);
        options.onLevel(rmsDb, peakDb, clipped);
      }
    );

    captureBridge.postMessage({
      type: 'start',
      startAtTime: 0
    });

    this.micMonitorSession = {
      context,
      stream,
      sourceNode,
      captureBridge,
      loopbackGainNode
    };
  }

  /**
   * Updates loopback monitoring gain smoothly without restarting the active microphone stream.
   */
  setMicMonitorLoopback(loopback: boolean): void {
    const session = this.micMonitorSession;
    if (!session) {
      return;
    }
    const now = session.context.currentTime;
    try {
      session.loopbackGainNode.gain.cancelScheduledValues(now);
      session.loopbackGainNode.gain.setValueAtTime(
        session.loopbackGainNode.gain.value,
        now
      );
      session.loopbackGainNode.gain.linearRampToValueAtTime(
        loopback ? 1 : 0,
        now + ADSR_RELEASE_SEC
      );
    } catch {
      session.loopbackGainNode.gain.value = loopback ? 1 : 0;
    }
  }

  /**
   * Stops Settings Modal Mic Check monitoring and releases the microphone stream.
   */
  stopMicMonitor(): void {
    const session = this.micMonitorSession;
    if (!session) {
      return;
    }
    this.micMonitorSession = null;

    try {
      session.captureBridge.postMessage({ type: 'dispose' });
    } catch {
      // Ignore port dispose errors
    }

    try {
      session.sourceNode.disconnect();
      session.captureBridge.disconnect();
      session.loopbackGainNode.disconnect();
    } catch {
      // Ignore disconnect errors
    }

    stopMediaStreamTracks(session.stream);
  }

  /**
   * Releases all active audio streams, timers, device listeners, and closes the underlying `AudioContext`.
   */
  async dispose(): Promise<void> {
    if (this.recordingSession) {
      await this.stopRecording();
    }
    this.stopPlayback();
    this.stopReferenceTone();
    this.stopMicMonitor();

    for (const unsub of [...this.deviceUnsubscribers]) {
      unsub();
    }
    this.deviceUnsubscribers.clear();

    if (this.sharedContext && this.sharedContext.state !== 'closed') {
      try {
        await this.sharedContext.close();
      } catch {
        // Ignore close errors
      }
    }
    this.sharedContext = null;
  }
}

export interface StudioEngineAdapter {
  startRecording(options: {
    inputDeviceId?: string;
    outputDeviceId?: string;
    sampleRate: SampleRateHz;
    targetNote: ScaleNote;
    guide: GuideAudioMode;
    onTelemetry?: (telemetry: LiveAudioTelemetry) => void;
  }): Promise<void>;
  stopRecording(): Promise<StopRecordingResult | null>;
  playSamples(
    samples: Float32Array,
    sampleRate: number,
    options?: { outputDeviceId?: string; onEnded?: () => void }
  ): Promise<void>;
  stopPlayback(): void;
  startReferenceTone(request: ReferenceToneRequest): Promise<void>;
  stopReferenceTone(): void;
  dispose(): void;
}

/**
 * Ready-to-wire Stage 3 adapter wrapping `StudioAudioEngine` to satisfy `studio-ui`'s `StudioAudioAdapter` contract,
 * including automatic `window.aie.audioFile.readAudioFileBytes` loading for `custom-file` guide BGM.
 */
export function createStudioEngineAdapter(
  engine: StudioAudioEngine = new StudioAudioEngine(),
  readAudioFileBytes?: (filePath: string) => Promise<Uint8Array>
): StudioEngineAdapter {
  const resolveFileReader = ():
    | ((filePath: string) => Promise<Uint8Array>)
    | undefined => {
    if (readAudioFileBytes) {
      return readAudioFileBytes;
    }
    if (typeof window !== 'undefined' && window.aie?.audioFile?.readAudioFileBytes) {
      return (filePath) => window.aie.audioFile.readAudioFileBytes(filePath);
    }
    return undefined;
  };

  return {
    async startRecording(options) {
      let customGuideWavBytes: Uint8Array | undefined;
      if (options.guide.kind === 'custom-file' && options.guide.audioFilePath) {
        const reader = resolveFileReader();
        if (reader) {
          try {
            customGuideWavBytes = await reader(options.guide.audioFilePath);
          } catch {
            // Proceed with recording even if custom guide file failed to read
          }
        }
      }

      await engine.startRecording({
        inputDeviceId: options.inputDeviceId,
        outputDeviceId: options.outputDeviceId,
        sampleRate: options.sampleRate,
        targetNote: options.targetNote,
        guideAudio: options.guide,
        customGuideWavBytes,
        onTelemetry: options.onTelemetry ?? (() => undefined)
      });
    },
    async stopRecording() {
      const result = await engine.stopRecording();
      return result.samples.length > 0 ? result : null;
    },
    async playSamples(samples, sampleRate, options) {
      await engine.playBuffer({
        samples,
        sampleRate,
        outputDeviceId: options?.outputDeviceId,
        onEnded: options?.onEnded
      });
    },
    stopPlayback() {
      engine.stopPlayback();
    },
    async startReferenceTone(request) {
      await engine.startReferenceTone(request);
    },
    stopReferenceTone() {
      engine.stopReferenceTone();
    },
    dispose() {
      void engine.dispose();
    }
  };
}
