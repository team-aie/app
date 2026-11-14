import type {
  AieProjectManifest,
  AppSettings,
  GuideAudioMode,
  LiveAudioTelemetry,
  ParsedRecordingListBundle,
  RecordingSetConfig,
  ReferenceToneRequest,
  SampleRateHz,
  ScaleNote,
  StudioWorkflowPrefs
} from '@shared/types';

/** Options passed to {@link StudioAudioAdapter.startRecording}. */
export interface StudioRecordingOptions {
  /** `MediaDeviceInfo.deviceId` of the microphone (empty string = system default). */
  inputDeviceId?: string;
  /** `MediaDeviceInfo.deviceId` of the speaker/headphones used for guide audio. */
  outputDeviceId?: string;
  /** Preferred capture sample rate (from `AppSettings.wavFormat.sampleRate`). */
  sampleRate: SampleRateHz;
  /** Target note of the active recording set (`RecordingSetConfig.scale`). */
  targetNote: ScaleNote;
  /** Guide audio to play while recording (`{ kind: 'none' }` when Guide BGM is off). */
  guide: GuideAudioMode;
  /** Called at up to ~60 Hz with live waveform / spectrum / f0 / meter telemetry. */
  onTelemetry?: (telemetry: LiveAudioTelemetry) => void;
}

/** Mono PCM take captured in memory. */
export interface StudioTakeBuffer {
  samples: Float32Array;
  sampleRate: number;
}

export interface StudioPlaybackOptions {
  outputDeviceId?: string;
  /** Called exactly once when playback reaches the end naturally (not after `stopPlayback()`). */
  onEnded?: () => void;
}

/**
 * Injectable audio engine seam for the Recording Studio.
 *
 * `audio-dsp`'s `StudioAudioEngine` implements this in Stage 3; until then the
 * Studio falls back to {@link createDefaultStudioAudioAdapter} (plain WebAudio).
 * Tests inject a fake so no hardware microphone is ever touched.
 */
export interface StudioAudioAdapter {
  /** Opens the mic (and starts guide audio) and begins capturing. */
  startRecording(options: StudioRecordingOptions): Promise<void>;
  /** Stops capture and resolves the captured mono take (`null` if nothing was captured). */
  stopRecording(): Promise<StudioTakeBuffer | null>;
  /** Starts playing a take; resolves once playback has started. */
  playSamples(
    samples: Float32Array,
    sampleRate: number,
    options?: StudioPlaybackOptions
  ): Promise<void>;
  /** Stops playback immediately (must not fire `onEnded`). */
  stopPlayback(): void;
  /** Starts the sustained reference pitch tone for the set's target note. */
  startReferenceTone(request: ReferenceToneRequest): Promise<void>;
  /** Stops the reference tone. */
  stopReferenceTone(): void;
  /** Optional teardown when the Studio unmounts. */
  dispose?(): void;
}

export interface RecordingStudioProps {
  manifest: AieProjectManifest;
  activeSet: RecordingSetConfig;
  bundle: ParsedRecordingListBundle;
  /** `.wav` file names already present in the set directory when the Studio opens. */
  initialRecordedFiles: string[];
  settings: AppSettings;
  onUpdateWorkflow: (patch: Partial<StudioWorkflowPrefs>) => void;
  onCursorChange?: (index: number) => void;
  onChangeScale?: (nextScale: ScaleNote) => void;
  onRevealProjectFolder?: () => void;
  onBackToProject: () => void;
  onOpenAudioSettings: () => void;
  /** Optional external engine (`StudioAudioEngine`); defaults to a built-in WebAudio adapter. */
  audioAdapter?: StudioAudioAdapter;
}

export type SidebarFilter = 'all' | 'unrecorded' | 'recorded';

export type StudioTransportPhase = 'idle' | 'recording' | 'saving' | 'playing';

/** Hygiene verdict for the most recent take. */
export interface TakeHygiene {
  fileName: string;
  peakDb: number;
  clipped: boolean;
  earlyCutoffWarning: boolean;
  quiet: boolean;
  durationMs: number;
}

export interface PlaybackClock {
  /** `performance.now()` timestamp at which playback started. */
  startedAtMs: number;
  durationMs: number;
}
