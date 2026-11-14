import { frequencyHzToPitchDelta, scaleNoteToFrequencyHz } from '@shared/music/chromatic';
import type { GuideAudioMode, LiveAudioTelemetry, ReferenceToneRequest, ScaleNote } from '@shared/types';
import { PitchDetector } from 'pitchy';
import { CLIP_THRESHOLD, amplitudeToDb, computePeak, computeRms, foldSpectrumToBands } from './studio-math';
import type {
  StudioAudioAdapter,
  StudioPlaybackOptions,
  StudioRecordingOptions,
  StudioTakeBuffer
} from './types';

type SinkCapableContext = AudioContext & { setSinkId?: (id: string) => Promise<void> };

async function routeToDevice(ctx: AudioContext, deviceId?: string): Promise<void> {
  const sinkCtx = ctx as SinkCapableContext;
  if (deviceId && deviceId !== 'default' && typeof sinkCtx.setSinkId === 'function') {
    try {
      await sinkCtx.setSinkId(deviceId);
    } catch {
      // Fall back to the system default output.
    }
  }
}

interface CaptureSession {
  ctx: AudioContext;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  processor: ScriptProcessorNode;
  sink: GainNode;
  chunks: Float32Array[];
  startedAt: number;
  raf: number;
  guideCtx: AudioContext | null;
  guideStop: (() => void) | null;
}

/**
 * Built-in WebAudio fallback so `<RecordingStudioScreen />` works standalone before
 * `audio-dsp`'s `AudioWorklet` engine is wired in. Uses `AnalyserNode` telemetry and a
 * `ScriptProcessorNode` tap (the app CSP forbids inline `blob:` worklet modules).
 */
export function createDefaultStudioAudioAdapter(): StudioAudioAdapter {
  let capture: CaptureSession | null = null;
  let playbackCtx: AudioContext | null = null;
  let playbackSource: AudioBufferSourceNode | null = null;
  let toneStop: (() => void) | null = null;

  const startGuide = async (
    guide: GuideAudioMode,
    targetNote: ScaleNote,
    outputDeviceId?: string
  ): Promise<{ ctx: AudioContext; stop: () => void } | null> => {
    if (guide.kind === 'none') return null;
    const ctx = new AudioContext();
    await routeToDevice(ctx, outputDeviceId);
    if (guide.kind === 'pitched-metronome') {
      const beat = 60 / Math.max(20, guide.bpm);
      const freq = scaleNoteToFrequencyHz(targetNote);
      const start = ctx.currentTime + 0.05;
      const beats = guide.leadInBeats + Math.max(1, guide.moraCount) + 8;
      const oscs: OscillatorNode[] = [];
      for (let i = 0; i < beats; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = i % 4 === 0 ? freq * 2 : freq;
        const at = start + i * beat;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(i < guide.leadInBeats ? 0.25 : 0.12, at + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.1);
        oscs.push(osc);
      }
      return {
        ctx,
        stop: () => {
          for (const o of oscs) {
            try {
              o.stop();
            } catch {
              /* already stopped */
            }
          }
          void ctx.close();
        }
      };
    }
    const bytes = await window.aie?.audioFile.readAudioFileBytes(guide.audioFilePath);
    if (!bytes) {
      void ctx.close();
      return null;
    }
    const copy = new Uint8Array(bytes);
    const buffer = await ctx.decodeAudioData(copy.buffer);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    return {
      ctx,
      stop: () => {
        try {
          src.stop();
        } catch {
          /* noop */
        }
        void ctx.close();
      }
    };
  };

  const adapter: StudioAudioAdapter = {
    async startRecording(options: StudioRecordingOptions) {
      if (capture) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: options.inputDeviceId ? { exact: options.inputDeviceId } : undefined,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: options.sampleRate });
      } catch {
        ctx = new AudioContext();
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const sink = ctx.createGain();
      sink.gain.value = 0;
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(analyser);
      source.connect(processor);
      processor.connect(sink).connect(ctx.destination);

      const guide = await startGuide(options.guide, options.targetNote, options.outputDeviceId).catch(
        () => null
      );

      const session: CaptureSession = {
        ctx,
        stream,
        source,
        analyser,
        processor,
        sink,
        chunks,
        startedAt: performance.now(),
        raf: 0,
        guideCtx: guide?.ctx ?? null,
        guideStop: guide?.stop ?? null
      };
      capture = session;

      const timeData = new Float32Array(analyser.fftSize);
      const freqData = new Float32Array(analyser.frequencyBinCount);
      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      detector.minVolumeDecibels = -45;
      const waveform = new Float32Array(512);
      const tick = () => {
        if (capture !== session) return;
        analyser.getFloatTimeDomainData(timeData);
        analyser.getFloatFrequencyData(freqData);
        const peak = computePeak(timeData);
        const [hz, clarity] = detector.findPitch(timeData, ctx.sampleRate);
        const voiced = clarity >= 0.9 && hz >= 50 && hz <= 1600;
        const delta = voiced ? frequencyHzToPitchDelta(hz, options.targetNote) : null;
        const step = timeData.length / waveform.length;
        for (let i = 0; i < waveform.length; i++) waveform[i] = timeData[Math.floor(i * step)] ?? 0;
        const telemetry: LiveAudioTelemetry = {
          rmsDb: amplitudeToDb(computeRms(timeData)),
          peakDb: amplitudeToDb(peak),
          clipped: peak >= CLIP_THRESHOLD,
          pitch: {
            frequencyHz: voiced ? hz : null,
            clarity,
            midiNote: delta?.midiNote ?? null,
            noteLabel: delta?.noteLabel ?? null,
            centsFromTarget: delta?.centsFromTarget ?? null
          },
          spectrumBands: foldSpectrumToBands(freqData, ctx.sampleRate),
          waveformSlice: new Float32Array(waveform),
          elapsedMs: performance.now() - session.startedAt
        };
        options.onTelemetry?.(telemetry);
        session.raf = requestAnimationFrame(tick);
      };
      session.raf = requestAnimationFrame(tick);
    },

    async stopRecording(): Promise<StudioTakeBuffer | null> {
      const session = capture;
      if (!session) return null;
      capture = null;
      cancelAnimationFrame(session.raf);
      session.guideStop?.();
      session.processor.onaudioprocess = null;
      session.source.disconnect();
      session.processor.disconnect();
      session.sink.disconnect();
      for (const track of session.stream.getTracks()) track.stop();
      const sampleRate = session.ctx.sampleRate;
      await session.ctx.close().catch(() => undefined);
      const total = session.chunks.reduce((n, c) => n + c.length, 0);
      if (total === 0) return null;
      const samples = new Float32Array(total);
      let offset = 0;
      for (const chunk of session.chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      return { samples, sampleRate };
    },

    async playSamples(samples: Float32Array, sampleRate: number, options?: StudioPlaybackOptions) {
      adapter.stopPlayback();
      if (!playbackCtx || playbackCtx.state === 'closed') {
        playbackCtx = new AudioContext();
        await routeToDevice(playbackCtx, options?.outputDeviceId);
      }
      if (playbackCtx.state === 'suspended') await playbackCtx.resume();
      const buffer = playbackCtx.createBuffer(1, Math.max(1, samples.length), sampleRate);
      buffer.copyToChannel(new Float32Array(samples), 0);
      const src = playbackCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(playbackCtx.destination);
      src.onended = () => {
        if (playbackSource === src) {
          playbackSource = null;
          options?.onEnded?.();
        }
      };
      playbackSource = src;
      src.start();
    },

    stopPlayback() {
      const src = playbackSource;
      playbackSource = null;
      if (src) {
        src.onended = null;
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }
    },

    async startReferenceTone(request: ReferenceToneRequest) {
      adapter.stopReferenceTone();
      const ctx = new AudioContext();
      await routeToDevice(ctx, request.outputDeviceId);
      const freq = scaleNoteToFrequencyHz(request.note);
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.03);
      master.connect(ctx.destination);
      const partials: OscillatorNode[] = [1, 2, 3].map((harmonic, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = freq * harmonic;
        g.gain.value = [1, 0.35, 0.15][i] ?? 0;
        osc.connect(g).connect(master);
        osc.start();
        return osc;
      });
      toneStop = () => {
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + 0.04);
        for (const osc of partials) osc.stop(now + 0.05);
        setTimeout(() => void ctx.close().catch(() => undefined), 120);
      };
    },

    stopReferenceTone() {
      const stop = toneStop;
      toneStop = null;
      stop?.();
    },

    dispose() {
      adapter.stopPlayback();
      adapter.stopReferenceTone();
      if (capture) void adapter.stopRecording();
      if (playbackCtx && playbackCtx.state !== 'closed') void playbackCtx.close();
      playbackCtx = null;
    }
  };
  return adapter;
}
