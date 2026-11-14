import type { ScaleNote } from './voicebank';

export type SampleRateHz = 44100 | 48000;
export type WavBitDepth = 16 | 24 | 32;
export type TransportRecordMode = 'hold' | 'toggle';

export interface WavFormatConfig {
  sampleRate: SampleRateHz;
  bitDepth: WavBitDepth;
  removeDcOffset: boolean;
}

export interface PitchEstimate {
  frequencyHz: number | null;
  clarity: number;
  midiNote: number | null;
  noteLabel: string | null;
  centsFromTarget: number | null;
}

export interface LiveAudioTelemetry {
  rmsDb: number;
  peakDb: number;
  clipped: boolean;
  pitch: PitchEstimate;
  /** 64-band normalized vocal spectrum magnitudes (0..1) */
  spectrumBands: Float32Array;
  /** Downsampled oscilloscope frame (-1..1) */
  waveformSlice: Float32Array;
  elapsedMs: number;
}

export interface RecordedTakePayload {
  projectRootPath: string;
  relativeDirectory: string;
  fileName: string;
  samples: Float32Array;
  format: WavFormatConfig;
}

export interface SavedTakeSummary {
  fullPath: string;
  durationMs: number;
  peakDb: number;
  clipped: boolean;
  earlyCutoffWarning: boolean;
  canUndoPreviousTake: boolean;
}

export interface ReferenceToneRequest {
  note: ScaleNote;
  outputDeviceId?: string;
}
