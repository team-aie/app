export type {
  LiveAudioTelemetry,
  PitchEstimate,
  ReferenceToneRequest,
  SampleRateHz,
  TransportRecordMode,
  WavBitDepth,
  WavFormatConfig
} from '@shared/types';

export {
  CLIPPING_THRESHOLD_DBFS,
  EARLY_CUTOFF_THRESHOLD_DBFS,
  EARLY_CUTOFF_WINDOW_MS,
  MIN_DBFS,
  amplitudeToDbfs,
  analyzeTakeSignal,
  decodeWavBytes,
  encodeWavBytes,
  removeDcOffset,
  type DecodedWavData,
  type TakeSignalAnalysis
} from './wav-codec';

export {
  DEFAULT_MIN_PITCH_CLARITY,
  PITCH_SILENCE_RMS_THRESHOLD,
  SPECTRUM_BAND_COUNT,
  SPECTRUM_FLOOR_DB,
  SPECTRUM_MAX_HZ,
  SPECTRUM_MIN_HZ,
  VOCAL_MAX_HZ,
  VOCAL_MIN_HZ,
  computeVocalSpectrum64,
  downsampleWaveformSlice,
  estimateVocalPitch
} from './dsp-analysis';

export {
  getMetronomeBeatTimestampsMs,
  synthesizePitchedMetronomeBuffer,
  type MetronomeBeatSchedule,
  type MetronomeTimingParams,
  type PitchedMetronomeSynthParams
} from './guide-synth';

export {
  CAPTURE_WORKLET_NAME,
  WORKLET_CHUNK_SIZE,
  WORKLET_PROCESSOR_SOURCE,
  createCaptureWorkletBlobUrl,
  revokeCaptureWorkletBlobUrl,
  type WorkletInboundMessage,
  type WorkletOutboundMessage
} from './worklet-processor-source';

export {
  StudioAudioEngine,
  createStudioEngineAdapter,
  type AudioDeviceOption,
  type EnumeratedAudioDevices,
  type MicMonitorOptions,
  type PlayBufferParams,
  type StartRecordingOptions,
  type StopRecordingResult,
  type StudioAudioEngineDeps,
  type StudioEngineAdapter
} from './studio-audio-engine';

import { StudioAudioEngine } from './studio-audio-engine';

let defaultStudioAudioEngine: StudioAudioEngine | null = null;

/**
 * Returns a shared singleton `StudioAudioEngine` instance for the renderer process.
 */
export function getSharedStudioAudioEngine(): StudioAudioEngine {
  if (!defaultStudioAudioEngine) {
    defaultStudioAudioEngine = new StudioAudioEngine();
  }
  return defaultStudioAudioEngine;
}
