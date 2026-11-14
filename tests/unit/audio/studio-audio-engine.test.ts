import { describe, expect, it, vi } from 'vitest';
import {
  CAPTURE_WORKLET_NAME,
  StudioAudioEngine,
  WORKLET_CHUNK_SIZE,
  WORKLET_PROCESSOR_SOURCE,
  createCaptureWorkletBlobUrl,
  createStudioEngineAdapter,
  encodeWavBytes,
  revokeCaptureWorkletBlobUrl,
  type LiveAudioTelemetry,
  type WorkletInboundMessage,
  type WorkletOutboundMessage
} from '@renderer/audio';
import { scaleNoteToFrequencyHz } from '@shared/music/chromatic';

interface SimulatedWorkletHarness {
  sendToWorklet: (msg: WorkletInboundMessage) => void;
  stepQuantum: (
    quantumTimeSec: number,
    sampleRate: number,
    monoInput: Float32Array
  ) => { keepAlive: boolean; output: Float32Array };
  emitted: WorkletOutboundMessage[];
}

function createWorkletProcessorHarness(): SimulatedWorkletHarness {
  type ProcessorInstance = {
    port: { onmessage: ((ev: { data: WorkletInboundMessage }) => void) | null };
    process: (
      inputs: Float32Array[][],
      outputs: Float32Array[][]
    ) => boolean;
  };
  type ProcessorCtor = new () => ProcessorInstance;

  const emitted: WorkletOutboundMessage[] = [];
  let registeredName = '';
  const registry: { ctor: ProcessorCtor | null } = { ctor: null };

  let currentClockTime = 0;
  let currentSampleRate = 48000;

  class MockAudioWorkletProcessor {
    port = {
      onmessage: null as ((ev: { data: WorkletInboundMessage }) => void) | null,
      postMessage: (msg: WorkletOutboundMessage) => {
        emitted.push(msg);
      }
    };
  }

  const factory = new Function(
    'AudioWorkletProcessor',
    'registerProcessor',
    'getClock',
    `
    let currentTime = 0;
    let sampleRate = 48000;
    return {
      init() {
        ${WORKLET_PROCESSOR_SOURCE}
      },
      syncClock() {
        const c = getClock();
        currentTime = c.currentTime;
        sampleRate = c.sampleRate;
      }
    };
    `
  ) as (
    baseCtor: typeof MockAudioWorkletProcessor,
    registerFn: (name: string, ctor: ProcessorCtor) => void,
    getClockFn: () => { currentTime: number; sampleRate: number }
  ) => { init: () => void; syncClock: () => void };

  const runtime = factory(
    MockAudioWorkletProcessor,
    (name, ctor) => {
      registeredName = name;
      registry.ctor = ctor;
    },
    () => ({ currentTime: currentClockTime, sampleRate: currentSampleRate })
  );
  runtime.init();

  expect(registeredName).toBe(CAPTURE_WORKLET_NAME);
  if (!registry.ctor) {
    throw new Error('Worklet processor failed to register');
  }
  const instance = new registry.ctor();

  return {
    emitted,
    sendToWorklet(msg) {
      instance.port.onmessage?.({ data: msg });
    },
    stepQuantum(quantumTimeSec, sampleRate, monoInput) {
      currentClockTime = quantumTimeSec;
      currentSampleRate = sampleRate;
      runtime.syncClock();
      const output = new Float32Array(monoInput.length);
      const keepAlive = instance.process([[monoInput]], [[output]]);
      return { keepAlive, output };
    }
  };
}

class FakeAudioParam {
  value = 0;
  readonly events: Array<{ op: string; value?: number; time: number }> = [];

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ op: 'setValueAtTime', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ op: 'linearRampToValueAtTime', value, time });
  }

  cancelScheduledValues(time: number): void {
    this.events.push({ op: 'cancelScheduledValues', time });
  }
}

function createFakeWebAudioRig(sampleRate = 48000) {
  const startedBufferSources: Array<{
    buffer: AudioBuffer | null;
    startWhen: number | undefined;
    stopped: boolean;
    triggerEnded: () => void;
  }> = [];
  const startedOscillators: Array<{
    frequencyHz: number;
    startedAt: number;
    stoppedAt: number | null;
  }> = [];
  const createdGains: Array<{ gain: FakeAudioParam }> = [];
  const sinkCalls: string[] = [];
  let failSpecificSinkOnce = false;

  const workletInbound: WorkletInboundMessage[] = [];
  let workletPortOnMessage: ((ev: MessageEvent<WorkletOutboundMessage>) => void) | null =
    null;

  let currentTime = 2.5;
  let state: AudioContextState = 'running';
  let sinkId = '';

  const fakeContext = {
    get sampleRate() {
      return sampleRate;
    },
    get currentTime() {
      return currentTime;
    },
    get state() {
      return state;
    },
    get sinkId() {
      return sinkId;
    },
    destination: {},
    audioWorklet: {
      addModule: vi.fn(async () => undefined)
    },
    setSinkId: vi.fn(async (nextSinkId: string) => {
      sinkCalls.push(nextSinkId);
      if (failSpecificSinkOnce && nextSinkId !== '') {
        failSpecificSinkOnce = false;
        throw new Error('NotFoundError: Device unplugged');
      }
      sinkId = nextSinkId;
    }),
    resume: vi.fn(async () => {
      state = 'running';
    }),
    close: vi.fn(async () => {
      state = 'closed';
    }),
    createGain: vi.fn(() => {
      const gain = new FakeAudioParam();
      const node = {
        gain,
        connect: vi.fn(),
        disconnect: vi.fn()
      };
      createdGains.push(node);
      return node;
    }),
    createMediaStreamSource: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn()
    })),
    createBuffer: vi.fn((channels: number, length: number, sr: number) => {
      const channelArrays = Array.from(
        { length: channels },
        () => new Float32Array(length)
      );
      return {
        numberOfChannels: channels,
        length,
        sampleRate: sr,
        duration: length / sr,
        getChannelData(ch: number) {
          return channelArrays[ch] ?? new Float32Array(0);
        }
      } as unknown as AudioBuffer;
    }),
    createBufferSource: vi.fn(() => {
      let endedHandler: (() => void) | null = null;
      const record = {
        buffer: null as AudioBuffer | null,
        startWhen: undefined as number | undefined,
        stopped: false,
        triggerEnded() {
          endedHandler?.();
        }
      };
      startedBufferSources.push(record);
      return {
        get buffer() {
          return record.buffer;
        },
        set buffer(b: AudioBuffer | null) {
          record.buffer = b;
        },
        get onended() {
          return endedHandler;
        },
        set onended(fn: (() => void) | null) {
          endedHandler = fn;
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn((when?: number) => {
          record.startWhen = when;
        }),
        stop: vi.fn(() => {
          record.stopped = true;
        })
      };
    }),
    createOscillator: vi.fn(() => {
      const freqParam = new FakeAudioParam();
      const record = {
        frequencyHz: 0,
        startedAt: -1,
        stoppedAt: null as number | null
      };
      startedOscillators.push(record);
      return {
        type: 'sine',
        frequency: {
          setValueAtTime(hz: number, t: number) {
            record.frequencyHz = hz;
            freqParam.setValueAtTime(hz, t);
          }
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn((when = 0) => {
          record.startedAt = when;
        }),
        stop: vi.fn((when = 0) => {
          record.stoppedAt = when;
        })
      };
    })
  };

  const fakeWorkletNode = {
    port: {
      get onmessage() {
        return workletPortOnMessage;
      },
      set onmessage(fn: ((ev: MessageEvent<WorkletOutboundMessage>) => void) | null) {
        workletPortOnMessage = fn;
      },
      postMessage: vi.fn((msg: WorkletInboundMessage) => {
        workletInbound.push(msg);
        if (msg.type === 'stop') {
          workletPortOnMessage?.({
            data: { type: 'stopped' }
          } as MessageEvent<WorkletOutboundMessage>);
        }
      })
    },
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  let stoppedTracksCount = 0;
  let deviceChangeHandler: (() => void) | null = null;
  let deviceList: MediaDeviceInfo[] = [
    {
      deviceId: 'default',
      groupId: 'g1',
      kind: 'audioinput',
      label: 'Scarlett Solo Mic',
      toJSON: () => ({})
    },
    {
      deviceId: 'usb-dac-out',
      groupId: 'g2',
      kind: 'audiooutput',
      label: 'Studio Headphones',
      toJSON: () => ({})
    }
  ];

  const getUserMediaCalls: MediaStreamConstraints[] = [];
  const fakeMediaDevices = {
    enumerateDevices: vi.fn(async () => deviceList),
    getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
      getUserMediaCalls.push(constraints);
      return {
        getTracks: () => [
          {
            stop: () => {
              stoppedTracksCount += 1;
            }
          } as unknown as MediaStreamTrack
        ]
      } as unknown as MediaStream;
    }),
    addEventListener: vi.fn((type: string, cb: EventListenerOrEventListenerObject) => {
      if (type === 'devicechange' && typeof cb === 'function') {
        deviceChangeHandler = cb as () => void;
      }
    }),
    removeEventListener: vi.fn((type: string, cb: EventListenerOrEventListenerObject) => {
      if (type === 'devicechange' && cb === deviceChangeHandler) {
        deviceChangeHandler = null;
      }
    })
  };

  return {
    context: fakeContext as unknown as AudioContext,
    workletNode: fakeWorkletNode as unknown as AudioWorkletNode,
    mediaDevices: fakeMediaDevices,
    startedBufferSources,
    startedOscillators,
    createdGains,
    sinkCalls,
    workletInbound,
    getUserMediaCalls,
    getStoppedTracksCount: () => stoppedTracksCount,
    advanceClock(deltaSec: number) {
      currentTime += deltaSec;
    },
    emitWorkletChunk(samples: Float32Array) {
      workletPortOnMessage?.({
        data: { type: 'chunk', samples }
      } as MessageEvent<WorkletOutboundMessage>);
    },
    triggerHotplug(nextDevices: MediaDeviceInfo[]) {
      deviceList = nextDevices;
      deviceChangeHandler?.();
    },
    armSinkFailureOnce() {
      failSpecificSinkOnce = true;
    }
  };
}

describe('StudioAudioEngine & Embedded Capture Worklet Processor', () => {
  it('gates AudioWorklet capture at the exact sub-quantum startAtTime sample offset', () => {
    const harness = createWorkletProcessorHarness();
    const sampleRate = 48000;
    // Start at t = 1.001s -> 48 samples into the quantum starting at t = 1.000s!
    harness.sendToWorklet({ type: 'start', startAtTime: 1.001 });

    const preGateQuantum = new Float32Array(128).fill(0.9);
    harness.stepQuantum(0.99, sampleRate, preGateQuantum);
    expect(harness.emitted).toHaveLength(0);

    // Straddling quantum at t = 1.000s: indices 0..47 are -0.5 (before gate), indices 48..127 are +0.25 (after gate = 80 samples)
    const straddle = new Float32Array(128);
    straddle.fill(-0.5, 0, 48);
    straddle.fill(0.25, 48, 128);
    const { keepAlive, output } = harness.stepQuantum(1.0, sampleRate, straddle);
    expect(keepAlive).toBe(true);
    // Hardware loopback pass-through mirrors input
    expect(output[0]).toBeCloseTo(-0.5, 5);
    expect(output[60]).toBeCloseTo(0.25, 5);

    // Feed 5 more 128-sample quanta (80 + 640 = 720 < WORKLET_CHUNK_SIZE=768) then 1 more (720 + 128 = 848 -> 1 full 768 chunk + 80 remainder)
    for (let q = 1; q <= 6; q++) {
      harness.stepQuantum(
        1.0 + (q * 128) / sampleRate,
        sampleRate,
        new Float32Array(128).fill(0.25)
      );
    }
    expect(harness.emitted).toHaveLength(1);
    const firstMsg = harness.emitted[0]!;
    expect(firstMsg.type).toBe('chunk');
    if (firstMsg.type === 'chunk') {
      expect(firstMsg.samples).toHaveLength(WORKLET_CHUNK_SIZE);
      // Zero pre-gate (-0.5) samples leaked in!
      expect(firstMsg.samples.every((s) => Math.abs(s - 0.25) < 1e-6)).toBe(
        true
      );
    }

    // Stop flushes the remaining 80 samples and emits 'stopped'
    harness.sendToWorklet({ type: 'stop' });
    expect(harness.emitted).toHaveLength(3);
    const flushMsg = harness.emitted[1]!;
    expect(flushMsg.type).toBe('chunk');
    if (flushMsg.type === 'chunk') {
      expect(flushMsg.samples).toHaveLength(80);
    }
    expect(harness.emitted[2]).toEqual({ type: 'stopped' });

    harness.sendToWorklet({ type: 'dispose' });
    expect(
      harness.stepQuantum(2.0, sampleRate, new Float32Array(128)).keepAlive
    ).toBe(false);
  });

  it('enumerates audio I/O devices and pushes hot-plug updates via subscribeDeviceChanges', async () => {
    const rig = createFakeWebAudioRig();
    const engine = new StudioAudioEngine({
      createAudioContext: () => rig.context,
      createWorkletNode: () => rig.workletNode,
      mediaDevices: rig.mediaDevices
    });

    const initial = await engine.enumerateAudioDevices();
    expect(initial.inputs).toHaveLength(1);
    expect(initial.inputs[0]?.label).toBe('Scarlett Solo Mic');
    expect(initial.outputs[0]?.deviceId).toBe('usb-dac-out');

    const hotplugSnapshots: number[] = [];
    const unsubscribe = engine.subscribeDeviceChanges((devices) => {
      hotplugSnapshots.push(devices.inputs.length);
    });

    rig.triggerHotplug([
      ...((await rig.mediaDevices.enumerateDevices()) as MediaDeviceInfo[]),
      {
        deviceId: 'shure-mv7',
        groupId: 'g3',
        kind: 'audioinput',
        label: '',
        toJSON: () => ({})
      }
    ]);

    await vi.waitFor(() => {
      expect(hotplugSnapshots).toEqual([2]);
    });

    unsubscribe();
    await engine.dispose();
  });

  it('locks pitched metronome and custom WAV guide playback to the exact AudioWorklet startAtTime and streams live telemetry', async () => {
    const rig = createFakeWebAudioRig(48000);
    const engine = new StudioAudioEngine({
      createAudioContext: () => rig.context,
      createWorkletNode: () => rig.workletNode,
      mediaDevices: rig.mediaDevices
    });

    const telemetryFrames: LiveAudioTelemetry[] = [];
    await engine.startRecording({
      inputDeviceId: 'studio-mic-1',
      outputDeviceId: 'usb-dac-out',
      sampleRate: 48000,
      targetNote: 'A4',
      guideAudio: {
        kind: 'pitched-metronome',
        bpm: 120,
        leadInBeats: 2,
        moraCount: 4
      },
      onTelemetry: (frame) => telemetryFrames.push(frame)
    });

    // Verify dry vocal booth mic constraints (no WebRTC AGC/NS/AEC coloration!)
    const audioConstraints = rig.getUserMediaCalls[0]?.audio as MediaTrackConstraints;
    expect(audioConstraints.echoCancellation).toBe(false);
    expect(audioConstraints.noiseSuppression).toBe(false);
    expect(audioConstraints.autoGainControl).toBe(false);
    expect(rig.sinkCalls).toContain('usb-dac-out');

    // Verify sample-clock lock: worklet 'start' and guideBufferSource.start receive IDENTICAL startAtTime
    const startMsg = rig.workletInbound.find((m) => m.type === 'start');
    expect(startMsg).toBeDefined();
    expect(rig.startedBufferSources).toHaveLength(1);
    expect(rig.startedBufferSources[0]?.startWhen).toBe(
      startMsg?.type === 'start' ? startMsg.startAtTime : -1
    );

    // Stream 3 chunks (3 * 768 = 2304 samples > 2048 window) of 440 Hz A4 sine wave
    const fullWave = new Float32Array(2304);
    for (let i = 0; i < fullWave.length; i++) {
      fullWave[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000);
    }
    rig.emitWorkletChunk(fullWave.slice(0, 768));
    rig.emitWorkletChunk(fullWave.slice(768, 1536));
    rig.emitWorkletChunk(fullWave.slice(1536, 2304));

    expect(telemetryFrames).toHaveLength(3);
    const latest = telemetryFrames[2]!;
    expect(latest.pitch.noteLabel).toBe('A4');
    expect(latest.pitch.centsFromTarget).toBe(0);
    expect(latest.spectrumBands).toHaveLength(64);
    expect(latest.waveformSlice).toHaveLength(256);
    expect(latest.clipped).toBe(false);

    const recorded = await engine.stopRecording();
    expect(recorded.sampleRate).toBe(48000);
    expect(recorded.samples).toHaveLength(2304);
    expect(rig.getStoppedTracksCount()).toBe(1);

    // Also verify custom guide WAV bytes + unplugged output sink fallback
    const customWav = encodeWavBytes(new Float32Array(4800).fill(0.1), {
      sampleRate: 48000,
      bitDepth: 16,
      removeDcOffset: false
    });
    rig.armSinkFailureOnce();
    await engine.startRecording({
      outputDeviceId: 'unplugged-headset',
      sampleRate: 48000,
      targetNote: 'C4',
      guideAudio: { kind: 'custom-file', audioFilePath: '/tmp/guide.wav' },
      customGuideWavBytes: customWav,
      onTelemetry: () => undefined
    });
    // Fell back cleanly to '' (system default sink)
    expect(rig.sinkCalls.at(-1)).toBe('');
    expect(rig.startedBufferSources).toHaveLength(2);
    await engine.stopRecording();
    await engine.dispose();
  });

  it('handles reference scale ADSR synth, buffer playback stop vs natural end, and Mic Check loopback monitor', async () => {
    const rig = createFakeWebAudioRig(48000);
    const engine = new StudioAudioEngine({
      createAudioContext: () => rig.context,
      createWorkletNode: () => rig.workletNode,
      mediaDevices: rig.mediaDevices
    });

    // 1. Reference Scale Synth (3 harmonics + 15ms ADSR attack & 15ms release)
    await engine.startReferenceTone('F#4', 'usb-dac-out');
    const fSharp4Hz = scaleNoteToFrequencyHz('F#4');
    expect(rig.startedOscillators).toHaveLength(3);
    expect(rig.startedOscillators[0]?.frequencyHz).toBeCloseTo(fSharp4Hz, 3);
    expect(rig.startedOscillators[1]?.frequencyHz).toBeCloseTo(
      fSharp4Hz * 2,
      3
    );
    expect(rig.startedOscillators[2]?.frequencyHz).toBeCloseTo(
      fSharp4Hz * 3,
      3
    );

    const envelopeEvents = rig.createdGains[0]?.gain.events ?? [];
    expect(envelopeEvents[0]).toEqual({
      op: 'setValueAtTime',
      value: 0,
      time: 2.5
    });
    expect(envelopeEvents[1]).toEqual({
      op: 'linearRampToValueAtTime',
      value: 1,
      time: 2.515
    });

    rig.advanceClock(0.2);
    engine.stopReferenceTone();
    expect(envelopeEvents.at(-1)).toEqual({
      op: 'linearRampToValueAtTime',
      value: 0,
      time: 2.7 + 0.015
    });

    // 2. Playback natural completion vs manual stopPlayback()
    let naturalEndedCount = 0;
    const progressPositions: number[] = [];
    await engine.playBuffer({
      samples: new Float32Array(24000).fill(0.2),
      sampleRate: 48000,
      onProgress: (ms) => progressPositions.push(ms),
      onEnded: () => {
        naturalEndedCount += 1;
      }
    });
    rig.startedBufferSources[0]?.triggerEnded();
    expect(naturalEndedCount).toBe(1);
    expect(progressPositions.at(-1)).toBeCloseTo(500, 2);

    // Manual stopPlayback() must NOT fire onEnded (prevents false Auto-Advance)
    await engine.playBuffer({
      samples: new Float32Array(24000).fill(0.2),
      sampleRate: 48000,
      onEnded: () => {
        naturalEndedCount += 1;
      }
    });
    engine.stopPlayback();
    rig.startedBufferSources[1]?.triggerEnded();
    expect(naturalEndedCount).toBe(1);

    // 3. Mic Check Monitor with live loopback gain toggle
    const levels: Array<{ rmsDb: number; peakDb: number; clipped: boolean }> =
      [];
    await engine.startMicMonitor({
      outputDeviceId: 'usb-dac-out',
      loopback: false,
      onLevel: (rmsDb, peakDb, clipped) =>
        levels.push({ rmsDb, peakDb, clipped })
    });
    rig.emitWorkletChunk(new Float32Array(256).fill(1.0));
    expect(levels).toHaveLength(1);
    expect(levels[0]?.clipped).toBe(true);

    engine.setMicMonitorLoopback(true);
    engine.stopMicMonitor();
    expect(rig.getStoppedTracksCount()).toBe(1);

    await engine.dispose();
  });

  it('creates and revokes application/javascript Blob URLs and falls back when a saved mic is unplugged', async () => {
    const createdBlobs: Blob[] = [];
    const revokedUrls: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (obj: Blob) => {
        createdBlobs.push(obj);
        return 'blob:aie-worklet-test-1';
      }
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: (url: string) => {
        revokedUrls.push(url);
      }
    });

    try {
      const url = createCaptureWorkletBlobUrl();
      expect(url).toBe('blob:aie-worklet-test-1');
      expect(createdBlobs[0]?.type).toBe('application/javascript');
      revokeCaptureWorkletBlobUrl(url);
      expect(revokedUrls).toEqual(['blob:aie-worklet-test-1']);

      const rig = createFakeWebAudioRig(44100);
      let attempts = 0;
      rig.mediaDevices.getUserMedia = vi.fn(
        async (constraints: MediaStreamConstraints) => {
          attempts += 1;
          const audio = constraints.audio as MediaTrackConstraints;
          const dev = audio.deviceId as ConstrainDOMStringParameters | undefined;
          if (dev && 'exact' in dev) {
            throw new Error('OverconstrainedError: Mic unplugged');
          }
          return {
            getTracks: () => [{ stop: () => undefined } as unknown as MediaStreamTrack]
          } as unknown as MediaStream;
        }
      );

      const engine = new StudioAudioEngine({
        createAudioContext: () => rig.context,
        createWorkletNode: () => rig.workletNode,
        mediaDevices: rig.mediaDevices
      });

      await engine.startRecording({
        inputDeviceId: 'unplugged-usb-mic',
        sampleRate: 44100,
        targetNote: 'G4',
        guideAudio: { kind: 'none' },
        onTelemetry: () => undefined
      });
      expect(attempts).toBe(2);
      // Worklet module Blob URL created and immediately revoked in finally block
      expect(revokedUrls).toContain('blob:aie-worklet-test-1');

      await engine.stopRecording();
      await engine.dispose();
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: origCreate
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: origRevoke
      });
    }
  });

  it('falls back seamlessly to sample-clock-gated ScriptProcessorNode when CSP blocks blob: worklets and supports StudioEngineAdapter', async () => {
    const rig = createFakeWebAudioRig(48000);
    // Simulate Chromium `script-src 'self'` rejecting blob: AudioWorklet.addModule
    (rig.context.audioWorklet.addModule as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('SecurityError: Blocked by Content-Security-Policy')
    );

    const scriptBox: {
      handler: ((ev: AudioProcessingEvent) => void) | null;
    } = { handler: null };
    (
      rig.context as unknown as {
        createScriptProcessor: (bufSize: number) => ScriptProcessorNode;
      }
    ).createScriptProcessor = vi.fn(() => {
      return {
        get onaudioprocess() {
          return scriptBox.handler;
        },
        set onaudioprocess(fn: ((ev: AudioProcessingEvent) => void) | null) {
          scriptBox.handler = fn;
        },
        connect: vi.fn(),
        disconnect: vi.fn()
      } as unknown as ScriptProcessorNode;
    });

    const engine = new StudioAudioEngine({
      createAudioContext: () => rig.context,
      mediaDevices: rig.mediaDevices
    });
    const customWavBytes = encodeWavBytes(new Float32Array(2400).fill(0.15), {
      sampleRate: 48000,
      bitDepth: 16,
      removeDcOffset: false
    });
    const adapter = createStudioEngineAdapter(engine, async () => customWavBytes);

    const telemetry: LiveAudioTelemetry[] = [];
    await adapter.startRecording({
      sampleRate: 48000,
      targetNote: 'A4',
      guide: { kind: 'custom-file', audioFilePath: '/tmp/bgm.wav' },
      onTelemetry: (t) => telemetry.push(t)
    });

    expect(scriptBox.handler).not.toBeNull();
    // Feed 1024 samples of 440 Hz sine wave starting after startAtTime (t = 2.51s)
    const inputCh = new Float32Array(1024);
    for (let i = 0; i < inputCh.length; i++) {
      inputCh[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000);
    }
    const outputCh = new Float32Array(1024);
    scriptBox.handler?.({
      playbackTime: 2.6 + 1024 / 48000,
      inputBuffer: {
        numberOfChannels: 1,
        length: 1024,
        sampleRate: 48000,
        getChannelData: () => inputCh
      },
      outputBuffer: {
        numberOfChannels: 1,
        length: 1024,
        sampleRate: 48000,
        getChannelData: () => outputCh
      }
    } as unknown as AudioProcessingEvent);

    const take = await adapter.stopRecording();
    expect(take).not.toBeNull();
    expect(take?.samples).toHaveLength(1024);
    expect(telemetry.length).toBeGreaterThanOrEqual(2);

    await adapter.startReferenceTone({ note: 'C4', outputDeviceId: 'usb-dac-out' });
    adapter.stopReferenceTone();
    adapter.dispose();
  });
});
