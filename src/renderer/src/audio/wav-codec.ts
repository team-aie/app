import type { WavFormatConfig } from '@shared/types';
import { WaveFile } from 'wavefile';

export const MIN_DBFS = -100;
export const CLIPPING_THRESHOLD_DBFS = -0.1;
export const EARLY_CUTOFF_WINDOW_MS = 40;
export const EARLY_CUTOFF_THRESHOLD_DBFS = -28;

export interface TakeSignalAnalysis {
  durationMs: number;
  rmsDb: number;
  peakDb: number;
  clipped: boolean;
  earlyCutoffWarning: boolean;
}

export interface DecodedWavData {
  samples: Float32Array;
  sampleRate: number;
  bitDepth: number;
}

interface WaveFileFmtChunk {
  sampleRate?: number;
  numChannels?: number;
  bitsPerSample?: number;
}

/**
 * Converts a linear amplitude (`>= 0`) into decibels relative to full scale (`dBFS`),
 * clamping silence and sub-floor noise to `minDb` so UI meters never receive `-Infinity` or `NaN`.
 */
export function amplitudeToDbfs(
  amplitude: number,
  minDb: number = MIN_DBFS
): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0) {
    return minDb;
  }
  const db = 20 * Math.log10(amplitude);
  return db < minDb ? minDb : db;
}

/**
 * Removes DC offset (`x[i] - mean(x)`) from a mono PCM float buffer using a
 * double-precision accumulator so long vocal takes suffer zero summation drift.
 */
export function removeDcOffset(samples: Float32Array): Float32Array {
  const length = samples.length;
  if (length === 0) {
    return new Float32Array(0);
  }

  let sum = 0;
  for (let i = 0; i < length; i++) {
    const value = samples[i] ?? 0;
    if (Number.isFinite(value)) {
      sum += value;
    }
  }

  const mean = sum / length;
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const value = samples[i] ?? 0;
    output[i] = Number.isFinite(value) ? value - mean : 0;
  }
  return output;
}

/**
 * Computes vocal take hygiene metrics:
 * - `durationMs`
 * - `rmsDb` & `peakDb` (clamped at `-100 dBFS` floor)
 * - `clipped`: `true` when peak reaches `>= -0.1 dBFS`
 * - `earlyCutoffWarning`: `true` when the trailing 40 ms still carries `> -28 dBFS` RMS energy
 *   (indicating the singer released `R` before the final vowel finished decaying).
 */
export function analyzeTakeSignal(
  samples: Float32Array,
  sampleRate: number
): TakeSignalAnalysis {
  const length = samples.length;
  if (length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return {
      durationMs: 0,
      rmsDb: MIN_DBFS,
      peakDb: MIN_DBFS,
      clipped: false,
      earlyCutoffWarning: false
    };
  }

  let sumSquares = 0;
  let peakAmp = 0;

  for (let i = 0; i < length; i++) {
    const raw = samples[i] ?? 0;
    const sample = Number.isFinite(raw) ? raw : 0;
    sumSquares += sample * sample;
    const abs = Math.abs(sample);
    if (abs > peakAmp) {
      peakAmp = abs;
    }
  }

  const durationMs = (length / sampleRate) * 1000;
  const rmsAmp = Math.sqrt(sumSquares / length);
  const rmsDb = amplitudeToDbfs(rmsAmp);
  const rawPeakDb = peakAmp > 0 ? 20 * Math.log10(peakAmp) : -Infinity;
  const peakDb = amplitudeToDbfs(peakAmp);
  const clipped = rawPeakDb >= CLIPPING_THRESHOLD_DBFS;

  const trailingWindowSamples = Math.max(
    1,
    Math.floor((sampleRate * EARLY_CUTOFF_WINDOW_MS) / 1000)
  );
  const tailStart = Math.max(0, length - trailingWindowSamples);
  const tailCount = length - tailStart;

  let tailSumSquares = 0;
  for (let i = tailStart; i < length; i++) {
    const raw = samples[i] ?? 0;
    const sample = Number.isFinite(raw) ? raw : 0;
    tailSumSquares += sample * sample;
  }

  const tailRmsAmp = tailCount > 0 ? Math.sqrt(tailSumSquares / tailCount) : 0;
  const tailRmsDb = tailRmsAmp > 0 ? 20 * Math.log10(tailRmsAmp) : -Infinity;
  const earlyCutoffWarning = tailRmsDb > EARLY_CUTOFF_THRESHOLD_DBFS;

  return {
    durationMs,
    rmsDb,
    peakDb,
    clipped,
    earlyCutoffWarning
  };
}

function clampUnitSample(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  if (value < -1) {
    return -1;
  }
  return value;
}

/**
 * Encodes normalized mono `Float32Array` samples (`[-1, 1]`) into standard RIFF WAVE bytes
 * supporting `44100` & `48000` Hz (or any positive integer rate) and `16-bit PCM`,
 * `24-bit PCM`, or `32-bit IEEE Float` (`'32f'`).
 */
export function encodeWavBytes(
  samples: Float32Array,
  format: WavFormatConfig
): Uint8Array {
  if (!Number.isInteger(format.sampleRate) || format.sampleRate <= 0) {
    throw new RangeError(`Invalid WAV sampleRate: ${format.sampleRate}`);
  }

  const source = format.removeDcOffset ? removeDcOffset(samples) : samples;
  const length = source.length;
  const wav = new WaveFile();

  if (format.bitDepth === 16) {
    const pcm16 = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const clamped = clampUnitSample(source[i] ?? 0);
      pcm16[i] =
        clamped >= 0 ? Math.round(clamped * 32767) : Math.round(clamped * 32768);
    }
    wav.fromScratch(1, format.sampleRate, '16', pcm16);
  } else if (format.bitDepth === 24) {
    const pcm24 = new Int32Array(length);
    for (let i = 0; i < length; i++) {
      const clamped = clampUnitSample(source[i] ?? 0);
      pcm24[i] =
        clamped >= 0
          ? Math.round(clamped * 8388607)
          : Math.round(clamped * 8388608);
    }
    wav.fromScratch(1, format.sampleRate, '24', pcm24);
  } else if (format.bitDepth === 32) {
    const float32 = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const raw = source[i] ?? 0;
      float32[i] = Number.isFinite(raw) ? raw : 0;
    }
    wav.fromScratch(1, format.sampleRate, '32f', float32);
  } else {
    const exhaustiveCheck: never = format.bitDepth;
    throw new RangeError(`Unsupported WAV bitDepth: ${String(exhaustiveCheck)}`);
  }

  return wav.toBuffer();
}

function normalizeRawPcmSample(sample: number, bitDepthCode: string): number {
  if (bitDepthCode === '32f' || bitDepthCode === '64') {
    return Number.isFinite(sample) ? sample : 0;
  }
  if (bitDepthCode === '8') {
    const centered = sample - 128;
    return centered >= 0 ? centered / 127 : centered / 128;
  }
  const bits = Number.parseInt(bitDepthCode, 10);
  if (!Number.isFinite(bits) || bits <= 0) {
    return 0;
  }
  const maxNegative = 2 ** (bits - 1);
  const maxPositive = maxNegative - 1;
  return sample >= 0 ? sample / maxPositive : sample / maxNegative;
}

/**
 * Decodes RIFF/RF64 WAVE bytes into normalized mono `Float32Array` samples (`[-1, 1]`),
 * downmixing multi-channel files cleanly if needed.
 */
export function decodeWavBytes(bytes: Uint8Array): DecodedWavData {
  if (bytes.byteLength === 0) {
    throw new Error('Cannot decode empty WAV byte buffer.');
  }

  const wav = new WaveFile();
  wav.fromBuffer(bytes);

  if (wav.bitDepth === '4') {
    wav.fromIMAADPCM('16');
  } else if (wav.bitDepth === '8a') {
    wav.fromALaw('16');
  } else if (wav.bitDepth === '8m') {
    wav.fromMuLaw('16');
  }

  const fmt = wav.fmt as WaveFileFmtChunk;
  const sampleRate = fmt.sampleRate ?? 0;
  const numChannels = Math.max(1, fmt.numChannels ?? 1);
  const bitDepthCode = wav.bitDepth;
  const bitDepth = Number.parseInt(bitDepthCode, 10);

  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`Invalid WAV header sampleRate: ${String(sampleRate)}`);
  }
  if (!Number.isFinite(bitDepth) || bitDepth <= 0) {
    throw new Error(`Invalid WAV bitDepth code: ${bitDepthCode}`);
  }

  // Exact IEEE binary32 fast path for mono 32-bit float WAVs
  if (bitDepthCode === '32f' && numChannels === 1) {
    const rawFloat32 = wav.getSamples(
      true,
      Float32Array
    ) as unknown as Float32Array;
    const copy = new Float32Array(rawFloat32.length);
    for (let i = 0; i < rawFloat32.length; i++) {
      const value = rawFloat32[i] ?? 0;
      copy[i] = Number.isFinite(value) ? value : 0;
    }
    return {
      samples: copy,
      sampleRate,
      bitDepth
    };
  }

  const interleaved = wav.getSamples(true, Float64Array);
  const frameCount = Math.floor(interleaved.length / numChannels);
  const mono = new Float32Array(frameCount);

  if (numChannels === 1) {
    for (let i = 0; i < frameCount; i++) {
      mono[i] = normalizeRawPcmSample(interleaved[i] ?? 0, bitDepthCode);
    }
  } else {
    for (let frame = 0; frame < frameCount; frame++) {
      const offset = frame * numChannels;
      let acc = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        acc += normalizeRawPcmSample(
          interleaved[offset + ch] ?? 0,
          bitDepthCode
        );
      }
      mono[frame] = acc / numChannels;
    }
  }

  return {
    samples: mono,
    sampleRate,
    bitDepth
  };
}
