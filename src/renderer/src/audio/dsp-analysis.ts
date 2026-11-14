import { frequencyHzToPitchDelta } from '@shared/music/chromatic';
import type { PitchEstimate, ScaleNote } from '@shared/types';
import { PitchDetector } from 'pitchy';

export const VOCAL_MIN_HZ = 55;
export const VOCAL_MAX_HZ = 1200;
export const DEFAULT_MIN_PITCH_CLARITY = 0.75;
export const PITCH_SILENCE_RMS_THRESHOLD = 1e-3; // -60 dBFS

const PITCHY_CLARITY_THRESHOLD = 0.8;
const SUBHARMONIC_MAX_DOUBLED_HZ = 1100;
const SUBHARMONIC_MIN_HALF_CORR = 0.65;
const SUBHARMONIC_HALF_TO_FULL_RATIO = 0.78;

export const SPECTRUM_BAND_COUNT = 64;
export const SPECTRUM_MIN_HZ = 60;
export const SPECTRUM_MAX_HZ = 8000;
export const SPECTRUM_FLOOR_DB = -80;

const MAX_CACHED_DETECTORS = 8;
const pitchDetectorCache = new Map<
  number,
  {
    detector: PitchDetector<Float32Array>;
    centeredBuffer: Float32Array;
  }
>();

function getCachedPitchDetector(length: number): {
  detector: PitchDetector<Float32Array>;
  centeredBuffer: Float32Array;
} {
  const existing = pitchDetectorCache.get(length);
  if (existing) {
    return existing;
  }
  if (pitchDetectorCache.size >= MAX_CACHED_DETECTORS) {
    const oldestKey = pitchDetectorCache.keys().next().value;
    if (oldestKey !== undefined) {
      pitchDetectorCache.delete(oldestKey);
    }
  }
  const detector = PitchDetector.forFloat32Array(length);
  detector.clarityThreshold = PITCHY_CLARITY_THRESHOLD;
  const entry = {
    detector,
    centeredBuffer: new Float32Array(length)
  };
  pitchDetectorCache.set(length, entry);
  return entry;
}

function normalizedAutocorrelationInt(
  buffer: Float32Array,
  lag: number
): number {
  const length = buffer.length;
  if (lag <= 0 || lag >= length) {
    return 0;
  }
  const count = length - lag;
  let dot = 0;
  let energyA = 0;
  let energyB = 0;
  for (let i = 0; i < count; i++) {
    const a = buffer[i] ?? 0;
    const b = buffer[i + lag] ?? 0;
    dot += a * b;
    energyA += a * a;
    energyB += b * b;
  }
  const denom = Math.sqrt(energyA * energyB);
  return denom > 0 ? dot / denom : 0;
}

function findPeakAutocorrelationNearLag(
  buffer: Float32Array,
  targetLag: number
): { corr: number; lag: number } {
  const length = buffer.length;
  const center = Math.round(targetLag);
  const lo = Math.max(2, center - 2);
  const hi = Math.min(length - 3, center + 2);
  if (lo > hi) {
    const clamped = Math.max(1, Math.min(length - 1, center));
    return {
      corr: normalizedAutocorrelationInt(buffer, clamped),
      lag: targetLag
    };
  }

  let bestLag = lo;
  let bestCorr = -Infinity;
  for (let k = lo; k <= hi; k++) {
    const c = normalizedAutocorrelationInt(buffer, k);
    if (c > bestCorr) {
      bestCorr = c;
      bestLag = k;
    }
  }

  const y0 = normalizedAutocorrelationInt(buffer, bestLag - 1);
  const y1 = bestCorr;
  const y2 = normalizedAutocorrelationInt(buffer, bestLag + 1);
  const denom = 2 * (2 * y1 - y0 - y2);
  if (y1 >= y0 && y1 >= y2 && Math.abs(denom) > 1e-12) {
    const delta = (y0 - y2) / denom;
    if (Math.abs(delta) <= 1) {
      const refinedLag = bestLag + delta;
      const refinedCorr = Math.min(1, y1 - 0.25 * (y0 - y2) * delta);
      return { corr: refinedCorr, lag: refinedLag };
    }
  }

  return { corr: bestCorr, lag: bestLag };
}

const UNVOICED_PITCH_ESTIMATE: PitchEstimate = Object.freeze({
  frequencyHz: null,
  clarity: 0,
  midiNote: null,
  noteLabel: null,
  centsFromTarget: null
});

/**
 * Estimates human vocal fundamental pitch (`55 Hz – 1,200 Hz`) using McLeod Pitch Method (`pitchy`)
 * with subharmonic (`f0` vs `2 * f0`) octave disambiguation, and computes MIDI note, scientific pitch
 * label, and signed cents offset relative to `targetNote`.
 * Cleanly gates silence, DC-only buffers, low-clarity unvoiced fricatives/noise, and out-of-band frequencies.
 */
export function estimateVocalPitch(
  frame: Float32Array,
  sampleRate: number,
  targetNote: ScaleNote,
  minClarity: number = DEFAULT_MIN_PITCH_CLARITY
): PitchEstimate {
  const length = frame.length;
  if (length < 32 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { ...UNVOICED_PITCH_ESTIMATE };
  }

  let sum = 0;
  for (let i = 0; i < length; i++) {
    const sample = frame[i] ?? 0;
    if (Number.isFinite(sample)) {
      sum += sample;
    }
  }
  const mean = sum / length;

  const { detector, centeredBuffer } = getCachedPitchDetector(length);
  let acSumSquares = 0;
  for (let i = 0; i < length; i++) {
    const raw = frame[i] ?? 0;
    const centered = Number.isFinite(raw) ? raw - mean : 0;
    centeredBuffer[i] = centered;
    acSumSquares += centered * centered;
  }

  const acRms = Math.sqrt(acSumSquares / length);
  if (acRms < PITCH_SILENCE_RMS_THRESHOLD) {
    return { ...UNVOICED_PITCH_ESTIMATE };
  }

  const [rawFreqHz, rawClarity] = detector.findPitch(
    centeredBuffer,
    sampleRate
  );
  const safeClarity = Number.isFinite(rawClarity)
    ? Math.max(0, Math.min(1, rawClarity))
    : 0;

  let resolvedFreqHz = rawFreqHz;
  if (
    Number.isFinite(resolvedFreqHz) &&
    resolvedFreqHz >= VOCAL_MIN_HZ &&
    safeClarity >= minClarity
  ) {
    // Disambiguate f0 vs 2 * f0 subharmonic octave drops:
    // Room reflections, breathiness, or slight odd/even glottal cycle modulation can make 2 * T0
    // exceed T0 in NSDF. Genuine lower-octave vocal notes have odd harmonics that cancel at T0 / 2
    // (low or negative correlation), whereas a subharmonic-locked note maintains strong positive
    // correlation at halfLag.
    for (
      let step = 0;
      step < 2 && resolvedFreqHz * 2 <= SUBHARMONIC_MAX_DOUBLED_HZ;
      step++
    ) {
      const lag = sampleRate / resolvedFreqHz;
      const halfLag = sampleRate / (2 * resolvedFreqHz);
      if (halfLag < 2 || lag >= length - 2) {
        break;
      }
      const fullPeak = findPeakAutocorrelationNearLag(centeredBuffer, lag);
      const halfPeak = findPeakAutocorrelationNearLag(centeredBuffer, halfLag);
      if (
        halfPeak.corr >= SUBHARMONIC_MIN_HALF_CORR &&
        halfPeak.corr >= SUBHARMONIC_HALF_TO_FULL_RATIO * fullPeak.corr &&
        halfPeak.lag > 0
      ) {
        resolvedFreqHz = sampleRate / halfPeak.lag;
      } else {
        break;
      }
    }
  }

  if (
    !Number.isFinite(resolvedFreqHz) ||
    resolvedFreqHz < VOCAL_MIN_HZ ||
    resolvedFreqHz > VOCAL_MAX_HZ ||
    safeClarity < minClarity
  ) {
    return {
      frequencyHz: null,
      clarity: safeClarity,
      midiNote: null,
      noteLabel: null,
      centsFromTarget: null
    };
  }

  const delta = frequencyHzToPitchDelta(resolvedFreqHz, targetNote);
  const normalizedCents =
    delta.centsFromTarget === 0 ? 0 : delta.centsFromTarget;
  return {
    frequencyHz: resolvedFreqHz,
    clarity: safeClarity,
    midiNote: delta.midiNote,
    noteLabel: delta.noteLabel,
    centsFromTarget: normalizedCents
  };
}

interface Radix2FftPlan {
  readonly size: number;
  readonly bitRev: Uint32Array;
  readonly twiddleRe: Float64Array;
  readonly twiddleIm: Float64Array;
  readonly re: Float64Array;
  readonly im: Float64Array;
  readonly magnitudes: Float64Array;
}

const fftPlanCache = new Map<number, Radix2FftPlan>();
const hannWindowCache = new Map<number, Float64Array>();

function ceilPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) {
    p <<= 1;
  }
  return p;
}

function getHannWindow(length: number): Float64Array {
  const cached = hannWindowCache.get(length);
  if (cached) {
    return cached;
  }
  if (hannWindowCache.size >= 8) {
    const oldest = hannWindowCache.keys().next().value;
    if (oldest !== undefined) {
      hannWindowCache.delete(oldest);
    }
  }
  const win = new Float64Array(length);
  if (length === 1) {
    win[0] = 1;
  } else {
    const denom = length - 1;
    for (let i = 0; i < length; i++) {
      win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom));
    }
  }
  hannWindowCache.set(length, win);
  return win;
}

function getRadix2FftPlan(size: number): Radix2FftPlan {
  const cached = fftPlanCache.get(size);
  if (cached) {
    return cached;
  }

  const bits = Math.round(Math.log2(size));
  const bitRev = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let x = i;
    let rev = 0;
    for (let b = 0; b < bits; b++) {
      rev = (rev << 1) | (x & 1);
      x >>= 1;
    }
    bitRev[i] = rev;
  }

  const twiddleRe = new Float64Array(size);
  const twiddleIm = new Float64Array(size);
  for (let halfSize = 1; halfSize < size; halfSize <<= 1) {
    for (let k = 0; k < halfSize; k++) {
      const angle = (-Math.PI * k) / halfSize;
      twiddleRe[halfSize + k] = Math.cos(angle);
      twiddleIm[halfSize + k] = Math.sin(angle);
    }
  }

  const plan: Radix2FftPlan = {
    size,
    bitRev,
    twiddleRe,
    twiddleIm,
    re: new Float64Array(size),
    im: new Float64Array(size),
    magnitudes: new Float64Array((size >> 1) + 1)
  };

  if (fftPlanCache.size >= 4) {
    const oldest = fftPlanCache.keys().next().value;
    if (oldest !== undefined) {
      fftPlanCache.delete(oldest);
    }
  }
  fftPlanCache.set(size, plan);
  return plan;
}

/**
 * Pure-TS Hann-windowed radix-2 Cooley-Tukey FFT mapping vocal frequencies
 * (`60 Hz – 8,000 Hz`, logarithmically spaced) into 64 normalized `[0..1]` magnitude bands
 * over an `80 dB` studio dynamic range (`-80 dBFS` -> `0`, `0 dBFS` -> `1`).
 */
export function computeVocalSpectrum64(
  frame: Float32Array,
  sampleRate: number
): Float32Array {
  const bands = new Float32Array(SPECTRUM_BAND_COUNT);
  if (frame.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return bands;
  }

  const inputLength = Math.min(frame.length, 8192);
  const fftSize = Math.max(4096, ceilPowerOfTwo(inputLength));
  const plan = getRadix2FftPlan(fftSize);
  const hann = getHannWindow(inputLength);

  // Subtract frame DC mean before windowing so DC offset never bleeds into low vocal bands
  let sum = 0;
  for (let i = 0; i < inputLength; i++) {
    const v = frame[i] ?? 0;
    if (Number.isFinite(v)) {
      sum += v;
    }
  }
  const mean = sum / inputLength;

  const { re, im, bitRev, twiddleRe, twiddleIm, magnitudes } = plan;
  let maxWindowedAbs = 0;

  // Populate bit-reversed input directly (zero-padding indices >= inputLength)
  re.fill(0);
  im.fill(0);
  for (let n = 0; n < inputLength; n++) {
    const raw = frame[n] ?? 0;
    const centered = Number.isFinite(raw) ? raw - mean : 0;
    const windowed = centered * (hann[n] ?? 0);
    const abs = Math.abs(windowed);
    if (abs > maxWindowedAbs) {
      maxWindowedAbs = abs;
    }
    const revIndex = bitRev[n] ?? n;
    re[revIndex] = windowed;
  }

  if (maxWindowedAbs === 0) {
    return bands;
  }

  // Iterative Cooley-Tukey radix-2 DIT FFT
  for (let halfSize = 1; halfSize < fftSize; halfSize <<= 1) {
    const step = halfSize << 1;
    for (let group = 0; group < fftSize; group += step) {
      for (let k = 0; k < halfSize; k++) {
        const evenIdx = group + k;
        const oddIdx = evenIdx + halfSize;
        const twRe = twiddleRe[halfSize + k] ?? 1;
        const twIm = twiddleIm[halfSize + k] ?? 0;
        const oddRe = re[oddIdx] ?? 0;
        const oddIm = im[oddIdx] ?? 0;

        const tRe = twRe * oddRe - twIm * oddIm;
        const tIm = twRe * oddIm + twIm * oddRe;

        const uRe = re[evenIdx] ?? 0;
        const uIm = im[evenIdx] ?? 0;

        re[evenIdx] = uRe + tRe;
        im[evenIdx] = uIm + tIm;
        re[oddIdx] = uRe - tRe;
        im[oddIdx] = uIm - tIm;
      }
    }
  }

  // Single-sided Hann coherent-gain normalized magnitudes (1.0 = 0 dBFS sine wave)
  const halfBins = fftSize >> 1;
  const normScale = inputLength > 1 ? 4 / inputLength : 1;
  for (let bin = 0; bin <= halfBins; bin++) {
    const r = re[bin] ?? 0;
    const i = im[bin] ?? 0;
    magnitudes[bin] = normScale * Math.hypot(r, i);
  }

  const nyquist = sampleRate * 0.5;
  const freqRatio = SPECTRUM_MAX_HZ / SPECTRUM_MIN_HZ;
  const floorAmp = 10 ** (SPECTRUM_FLOOR_DB / 20); // 1e-4 for -80 dBFS
  const dynamicRangeDb = -SPECTRUM_FLOOR_DB;

  for (let b = 0; b < SPECTRUM_BAND_COUNT; b++) {
    const fLow = SPECTRUM_MIN_HZ * freqRatio ** (b / SPECTRUM_BAND_COUNT);
    const fHigh =
      SPECTRUM_MIN_HZ * freqRatio ** ((b + 1) / SPECTRUM_BAND_COUNT);

    if (fLow >= nyquist) {
      bands[b] = 0;
      continue;
    }

    const clampedHigh = Math.min(fHigh, nyquist);
    const fCenter = Math.sqrt(fLow * clampedHigh);
    const binLow = (fLow * fftSize) / sampleRate;
    const binHigh = (clampedHigh * fftSize) / sampleRate;
    const binCenter = (fCenter * fftSize) / sampleRate;

    const idx0 = Math.max(0, Math.min(halfBins, Math.floor(binCenter)));
    const idx1 = Math.min(halfBins, idx0 + 1);
    const frac = binCenter - idx0;
    let bandMag =
      (magnitudes[idx0] ?? 0) * (1 - frac) + (magnitudes[idx1] ?? 0) * frac;

    const startBin = Math.max(1, Math.ceil(binLow));
    const endBin = Math.min(halfBins, Math.floor(binHigh));
    for (let bin = startBin; bin <= endBin; bin++) {
      const m = magnitudes[bin] ?? 0;
      if (m > bandMag) {
        bandMag = m;
      }
    }

    if (bandMag <= floorAmp) {
      bands[b] = 0;
    } else {
      const db = 20 * Math.log10(bandMag);
      const normalized = (db - SPECTRUM_FLOOR_DB) / dynamicRangeDb;
      bands[b] = normalized <= 0 ? 0 : normalized >= 1 ? 1 : normalized;
    }
  }

  return bands;
}

/**
 * Downsamples a live PCM frame into a compact `[-1..1]` oscilloscope slice
 * preserving peak-extremum polarity per bucket so transients never vanish between samples.
 */
export function downsampleWaveformSlice(
  samples: Float32Array,
  targetPoints: number = 256
): Float32Array {
  const count = Math.max(1, Math.floor(targetPoints));
  const slice = new Float32Array(count);
  const length = samples.length;
  if (length === 0) {
    return slice;
  }

  if (length <= count) {
    for (let i = 0; i < count; i++) {
      const idx = Math.min(length - 1, Math.floor((i * length) / count));
      const v = samples[idx] ?? 0;
      slice[i] = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
    }
    return slice;
  }

  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * length) / count));
    let extreme = 0;
    let maxAbs = -1;
    for (let j = start; j < end && j < length; j++) {
      const v = samples[j] ?? 0;
      const finite = Number.isFinite(v) ? v : 0;
      const abs = Math.abs(finite);
      if (abs > maxAbs) {
        maxAbs = abs;
        extreme = finite;
      }
    }
    slice[i] = Math.max(-1, Math.min(1, extreme));
  }

  return slice;
}
