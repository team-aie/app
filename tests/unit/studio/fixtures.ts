import type {
  AieBridgeApi,
  AieProjectManifest,
  AppSettings,
  ParsedRecordingListBundle,
  RecordedTakePayload,
  RecordingSetConfig,
  ReclistEntry,
  SavedTakeSummary
} from '@shared/types';
import { vi } from 'vitest';
import { analyzeTake } from '@renderer/components/studio/studio-math';
import type {
  RecordingStudioProps,
  StudioAudioAdapter,
  StudioPlaybackOptions,
  StudioRecordingOptions,
  StudioTakeBuffer
} from '@renderer/components/studio/types';

export const SAMPLE_RATE = 8000;

/** 0.5 s 220 Hz sine with a silent tail (clean take). */
export function makeCleanTake(amplitude = 0.5): StudioTakeBuffer {
  const n = SAMPLE_RATE / 2;
  const samples = new Float32Array(n);
  const voiced = Math.floor(n * 0.7);
  for (let i = 0; i < voiced; i++) samples[i] = amplitude * Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE);
  return { samples, sampleRate: SAMPLE_RATE };
}

/** Hot take hitting 0 dBFS. */
export function makeClippedTake(): StudioTakeBuffer {
  const take = makeCleanTake(0.5);
  for (let i = 100; i < 200; i++) take.samples[i] = i % 2 === 0 ? 1 : -1;
  return take;
}

/** Voice still sounding at the very end (chopped). */
export function makeCutoffTake(): StudioTakeBuffer {
  const n = SAMPLE_RATE / 2;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE);
  return { samples, sampleRate: SAMPLE_RATE };
}

export class FakeStudioAudioAdapter implements StudioAudioAdapter {
  nextTake: StudioTakeBuffer | null = makeCleanTake();
  lastRecordingOptions: StudioRecordingOptions | null = null;
  private pendingEnded: (() => void) | undefined;

  startRecording = vi.fn(async (options: StudioRecordingOptions) => {
    this.lastRecordingOptions = options;
  });
  stopRecording = vi.fn(async () => this.nextTake);
  playSamples = vi.fn(async (_s: Float32Array, _sr: number, options?: StudioPlaybackOptions) => {
    this.pendingEnded = options?.onEnded;
  });
  stopPlayback = vi.fn(() => {
    this.pendingEnded = undefined;
  });
  startReferenceTone = vi.fn(async () => undefined);
  stopReferenceTone = vi.fn();
  dispose = vi.fn();

  /** Simulates the take reaching its natural end. */
  finishPlayback(): void {
    const cb = this.pendingEnded;
    this.pendingEnded = undefined;
    cb?.();
  }
}

export function makeEntries(): ReclistEntry[] {
  return [
    {
      index: 0,
      rawPrompt: '_a_ka_sa',
      fileStem: '_a_ka_sa',
      fileName: '_a_ka_sa.wav',
      syllables: ['- a', 'a k', 'ka'],
      pronunciationHint: '[a] - [ka] - [sa]',
      inlineComment: 'Keep it steady'
    },
    {
      index: 1,
      rawPrompt: '_i_ki_shi',
      fileStem: '_i_ki_shi',
      fileName: '_i_ki_shi.wav',
      syllables: []
    },
    {
      index: 2,
      rawPrompt: '_u_ku_su',
      fileStem: '_u_ku_su',
      fileName: '_u_ku_su.wav',
      syllables: []
    },
    {
      index: 3,
      rawPrompt: '_e_ke_se',
      fileStem: '_e_ke_se',
      fileName: '_e_ke_se.wav',
      syllables: []
    }
  ];
}

export function makeSet(overrides: Partial<RecordingSetConfig> = {}): RecordingSetConfig {
  return {
    id: 'set-g4',
    name: 'G4 CVVC',
    targetLocation: 'subfolder',
    subfolderName: 'G4',
    scale: 'G4',
    aliasSuffix: '_G4',
    reclistSource: { kind: 'builtin', builtinId: 'z_cvvc_normal' },
    guideAudio: { kind: 'pitched-metronome', bpm: 120, leadInBeats: 4, moraCount: 3 },
    generateCompanionFiles: true,
    lastCursorIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

export function makeSettings(workflow: Partial<AppSettings['workflow']> = {}): AppSettings {
  return {
    locale: 'en-US',
    theme: 'dark',
    inputDeviceId: 'mic-1',
    outputDeviceId: 'spk-1',
    wavFormat: { sampleRate: 48000, bitDepth: 24, removeDcOffset: true },
    workflow: {
      recordMode: 'hold',
      autoListenBack: false,
      autoAdvance: false,
      autoAdvanceDelayMs: 0,
      guideEnabled: false,
      showOtoGrid: true,
      autoZoomQuietTakes: false,
      ...workflow
    },
    externalTools: { vLabelerPath: '', openUtauPath: '' }
  };
}

export function makeProps(
  overrides: Partial<RecordingStudioProps> & { workflow?: Partial<AppSettings['workflow']> } = {}
): RecordingStudioProps & { audioAdapter: FakeStudioAudioAdapter } {
  const activeSet = overrides.activeSet ?? makeSet();
  const manifest: AieProjectManifest = {
    schemaVersion: 1,
    id: 'p1',
    name: 'Test Singer',
    rootPath: '/voicebanks/test',
    sets: [activeSet],
    activeSetId: activeSet.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
  const bundle: ParsedRecordingListBundle = {
    entries: makeEntries(),
    otoEntries: [
      {
        fileName: '_a_ka_sa.wav',
        alias: '- a_G4',
        offsetMs: 50,
        consonantMs: 60,
        cutoffMs: -200,
        preutteranceMs: 40,
        overlapMs: 10
      }
    ],
    detectedEncoding: 'utf-8'
  };
  const { workflow, ...rest } = overrides;
  return {
    manifest,
    activeSet,
    bundle,
    initialRecordedFiles: ['_i_ki_shi.wav'],
    settings: makeSettings(workflow),
    onUpdateWorkflow: vi.fn(),
    onCursorChange: vi.fn(),
    onBackToProject: vi.fn(),
    onOpenAudioSettings: vi.fn(),
    ...rest,
    audioAdapter: (rest.audioAdapter as FakeStudioAudioAdapter | undefined) ?? new FakeStudioAudioAdapter()
  };
}

export interface MockBridge {
  api: AieBridgeApi;
  saveTake: ReturnType<typeof vi.fn>;
  readTakeSamples: ReturnType<typeof vi.fn>;
  undoLastRetake: ReturnType<typeof vi.fn>;
  trashTake: ReturnType<typeof vi.fn>;
  watchDirectory: ReturnType<typeof vi.fn>;
  revealInFileManager: ReturnType<typeof vi.fn>;
  openInExternalTool: ReturnType<typeof vi.fn>;
  emitDirectory: (names: string[]) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

/** Installs a fake `window.aie` bridge (main-process IPC) for Studio tests. */
export function installMockBridge(): MockBridge {
  let listener: ((names: string[]) => void) | null = null;
  const existing = new Set<string>(['_i_ki_shi.wav']);
  const unsubscribe = vi.fn();
  const saveTake = vi.fn(async (payload: RecordedTakePayload): Promise<SavedTakeSummary> => {
    const hygiene = analyzeTake(payload.fileName, payload.samples, SAMPLE_RATE);
    const hadPrevious = existing.has(payload.fileName);
    existing.add(payload.fileName);
    return {
      fullPath: `${payload.projectRootPath}/${payload.relativeDirectory}/${payload.fileName}`,
      durationMs: hygiene.durationMs,
      peakDb: hygiene.peakDb,
      clipped: hygiene.clipped,
      earlyCutoffWarning: hygiene.earlyCutoffWarning,
      canUndoPreviousTake: hadPrevious
    };
  });
  const readTakeSamples = vi.fn(async () => makeCleanTake(0.3));
  const undoLastRetake = vi.fn(async () => true);
  const trashTake = vi.fn(async () => undefined);
  const watchDirectory = vi.fn((_dir: string, onChanged: (names: string[]) => void) => {
    listener = onChanged;
    return unsubscribe;
  });
  const revealInFileManager = vi.fn(async () => undefined);
  const openInExternalTool = vi.fn(async () => ({ ok: true }));
  const api = {
    audioFile: {
      saveTake,
      readTakeSamples,
      undoLastRetake,
      trashTake,
      watchDirectory,
      readAudioFileBytes: vi.fn(async () => new Uint8Array())
    },
    shell: { revealInFileManager, openInExternalTool, openExternalUrl: vi.fn() }
  } as unknown as AieBridgeApi;
  (window as unknown as { aie?: AieBridgeApi }).aie = api;
  return {
    api,
    saveTake,
    readTakeSamples,
    undoLastRetake,
    trashTake,
    watchDirectory,
    revealInFileManager,
    openInExternalTool,
    unsubscribe,
    emitDirectory: (names) => listener?.(names)
  };
}

export function uninstallMockBridge(): void {
  delete (window as unknown as { aie?: AieBridgeApi }).aie;
}

/** jsdom has no canvas backend; return `null` so the renderer skips drawing quietly. */
export function stubCanvas(): void {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
}
