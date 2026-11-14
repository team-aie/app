import { scaleNoteToMidi } from '@shared/music/chromatic';
import type { OtoEntry, ReclistEntry, ScaleNote } from '@shared/types';
import { PitchDetector } from 'pitchy';
import type { SidebarFilter, TakeHygiene } from './types';

/** Silence floor used for dB conversions. */
export const DB_FLOOR = -120;
/** Linear peak at or above which a take is considered clipped (~-0.01 dBFS). */
export const CLIP_THRESHOLD = 0.999;
/** Tail RMS level (dBFS) above which the voice is still sounding when the take ends. */
export const EARLY_CUTOFF_TAIL_DB = -30;
/** Duration of the tail window inspected for early cutoff. */
export const EARLY_CUTOFF_TAIL_MS = 60;
/** Peak level below which a take is considered quiet (auto-zoom + hint). */
export const QUIET_TAKE_PEAK_DB = -24;
export const SPECTRUM_BAND_COUNT = 64;

export function amplitudeToDb(amplitude: number): number {
  if (!(amplitude > 0)) return DB_FLOOR;
  return Math.max(DB_FLOOR, 20 * Math.log10(amplitude));
}

export function computePeak(samples: Float32Array, start = 0, end = samples.length): number {
  let peak = 0;
  for (let i = Math.max(0, start); i < Math.min(end, samples.length); i++) {
    const v = Math.abs(samples[i] ?? 0);
    if (v > peak) peak = v;
  }
  return peak;
}

export function computeRms(samples: Float32Array, start = 0, end = samples.length): number {
  const from = Math.max(0, start);
  const to = Math.min(end, samples.length);
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / (to - from));
}

/** Local (renderer-side) hygiene check; `SavedTakeSummary` from main is authoritative when present. */
export function analyzeTake(
  fileName: string,
  samples: Float32Array,
  sampleRate: number
): TakeHygiene {
  const peak = computePeak(samples);
  const peakDb = amplitudeToDb(peak);
  const tailLength = Math.max(1, Math.round((EARLY_CUTOFF_TAIL_MS / 1000) * sampleRate));
  const tailRmsDb = amplitudeToDb(
    computeRms(samples, samples.length - tailLength, samples.length)
  );
  return {
    fileName,
    peakDb,
    clipped: peak >= CLIP_THRESHOLD,
    earlyCutoffWarning: samples.length > 0 && tailRmsDb >= EARLY_CUTOFF_TAIL_DB,
    quiet: samples.length > 0 && peakDb < QUIET_TAKE_PEAK_DB,
    durationMs: sampleRate > 0 ? (samples.length / sampleRate) * 1000 : 0
  };
}

/** Visual-only normalization gain for quiet takes (never applied to saved audio). */
export function computeAutoZoomGain(peak: number): number {
  if (!(peak > 0)) return 1;
  if (peak >= 0.5) return 1;
  return Math.min(16, 0.9 / peak);
}

/** Min/max envelope per pixel column for waveform overview drawing. */
export function computeMinMaxEnvelope(
  samples: Float32Array,
  columns: number
): { mins: Float32Array; maxs: Float32Array } {
  const count = Math.max(1, Math.floor(columns));
  const mins = new Float32Array(count);
  const maxs = new Float32Array(count);
  if (samples.length === 0) return { mins, maxs };
  const step = samples.length / count;
  for (let c = 0; c < count; c++) {
    const start = Math.floor(c * step);
    const end = Math.max(start + 1, Math.floor((c + 1) * step));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = start; i < end && i < samples.length; i++) {
      const v = samples[i] ?? 0;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    mins[c] = Number.isFinite(lo) ? lo : 0;
    maxs[c] = Number.isFinite(hi) ? hi : 0;
  }
  return { mins, maxs };
}

function bandEdgesHz(bands: number, minHz: number, maxHz: number): number[] {
  const edges: number[] = [];
  const ratio = maxHz / minHz;
  for (let b = 0; b <= bands; b++) edges.push(minHz * ratio ** (b / bands));
  return edges;
}

/**
 * Folds an FFT magnitude spectrum (in dB, e.g. `AnalyserNode.getFloatFrequencyData`)
 * into `bands` log-spaced vocal bands normalized to 0..1.
 */
export function foldSpectrumToBands(
  binsDb: ArrayLike<number>,
  sampleRate: number,
  options: { bands?: number; minHz?: number; maxHz?: number; floorDb?: number; ceilDb?: number } = {}
): Float32Array {
  const bands = options.bands ?? SPECTRUM_BAND_COUNT;
  const minHz = options.minHz ?? 60;
  const maxHz = Math.min(options.maxHz ?? 8000, sampleRate / 2);
  const floorDb = options.floorDb ?? -100;
  const ceilDb = options.ceilDb ?? -20;
  const out = new Float32Array(bands);
  const binCount = binsDb.length;
  if (binCount === 0) return out;
  const hzPerBin = sampleRate / 2 / binCount;
  const edges = bandEdgesHz(bands, minHz, maxHz);
  for (let b = 0; b < bands; b++) {
    const lo = Math.max(0, Math.floor((edges[b] ?? 0) / hzPerBin));
    const hi = Math.min(binCount - 1, Math.max(lo, Math.ceil((edges[b + 1] ?? 0) / hzPerBin) - 1));
    let best = -Infinity;
    for (let i = lo; i <= hi; i++) {
      const v = binsDb[i] ?? -Infinity;
      if (v > best) best = v;
    }
    const norm = (best - floorDb) / (ceilDb - floorDb);
    out[b] = Number.isFinite(norm) ? Math.min(1, Math.max(0, norm)) : 0;
  }
  return out;
}

/** In-place iterative radix-2 FFT. `re.length` must be a power of two. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k]!;
        const aIm = im[i + k]!;
        const bRe0 = re[i + k + len / 2]!;
        const bIm0 = im[i + k + len / 2]!;
        const bRe = bRe0 * curRe - bIm0 * curIm;
        const bIm = bRe0 * curIm + bIm0 * curRe;
        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe;
        im[i + k + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Offline 64-band spectrogram of an in-memory take for review mode. */
export function computeSpectrogramColumns(
  samples: Float32Array,
  sampleRate: number,
  maxColumns = 320,
  frameSize = 1024
): Float32Array[] {
  if (samples.length === 0 || sampleRate <= 0) return [];
  const columns = Math.max(1, Math.min(maxColumns, Math.floor(samples.length / (frameSize / 4))));
  const hop = Math.max(1, (samples.length - frameSize) / Math.max(1, columns - 1));
  const window = new Float64Array(frameSize);
  for (let i = 0; i < frameSize; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
  const re = new Float64Array(frameSize);
  const im = new Float64Array(frameSize);
  const binsDb = new Float32Array(frameSize / 2);
  const result: Float32Array[] = [];
  for (let c = 0; c < columns; c++) {
    const start = Math.floor(c * hop);
    for (let i = 0; i < frameSize; i++) {
      re[i] = (samples[start + i] ?? 0) * window[i]!;
      im[i] = 0;
    }
    fftInPlace(re, im);
    for (let k = 0; k < frameSize / 2; k++) {
      const mag = Math.hypot(re[k]!, im[k]!) / (frameSize / 4);
      binsDb[k] = amplitudeToDb(mag);
    }
    result.push(foldSpectrumToBands(binsDb, sampleRate));
  }
  return result;
}

export function frequencyToCentsFromTarget(frequencyHz: number, targetNote: ScaleNote): number {
  const exactMidi = 69 + 12 * Math.log2(frequencyHz / 440);
  return (exactMidi - scaleNoteToMidi(targetNote)) * 100;
}

/** Offline `pitchy` f0 track (cents vs. target; `null` = unvoiced) for review mode. */
export function computePitchTrack(
  samples: Float32Array,
  sampleRate: number,
  targetNote: ScaleNote,
  maxPoints = 320,
  frameSize = 2048
): Array<number | null> {
  if (samples.length < frameSize || sampleRate <= 0) return [];
  const detector = PitchDetector.forFloat32Array(frameSize);
  detector.minVolumeDecibels = -45;
  const points = Math.max(1, Math.min(maxPoints, Math.floor(samples.length / (frameSize / 4))));
  const hop = (samples.length - frameSize) / Math.max(1, points - 1);
  const track: Array<number | null> = [];
  for (let p = 0; p < points; p++) {
    const start = Math.floor(p * hop);
    const frame = samples.subarray(start, start + frameSize);
    const [pitch, clarity] = detector.findPitch(frame, sampleRate);
    track.push(
      clarity >= 0.9 && pitch >= 50 && pitch <= 1600
        ? frequencyToCentsFromTarget(pitch, targetNote)
        : null
    );
  }
  return track;
}

export type OtoMarkerKind = 'offset' | 'overlap' | 'preutterance' | 'consonant' | 'cutoff';

export interface OtoMarker {
  kind: OtoMarkerKind;
  alias: string;
  timeMs: number;
}

/**
 * Converts `oto.ini` entries for one `.wav` to absolute marker times (read-only display).
 * UTAU cutoff semantics: negative = length measured from offset, positive = trimmed from the end.
 */
export function buildOtoMarkers(entries: OtoEntry[], durationMs: number): OtoMarker[] {
  const markers: OtoMarker[] = [];
  for (const e of entries) {
    const offset = e.offsetMs;
    const cutoff =
      e.cutoffMs < 0
        ? offset + Math.abs(e.cutoffMs)
        : e.cutoffMs > 0
          ? durationMs - e.cutoffMs
          : durationMs;
    markers.push(
      { kind: 'offset', alias: e.alias, timeMs: offset },
      { kind: 'overlap', alias: e.alias, timeMs: offset + e.overlapMs },
      { kind: 'preutterance', alias: e.alias, timeMs: offset + e.preutteranceMs },
      { kind: 'consonant', alias: e.alias, timeMs: offset + e.consonantMs },
      { kind: 'cutoff', alias: e.alias, timeMs: cutoff }
    );
  }
  return markers;
}

export function otoEntriesForFile(otoEntries: OtoEntry[], fileName: string): OtoEntry[] {
  const target = fileName.toLowerCase();
  return otoEntries.filter((e) => e.fileName.toLowerCase() === target);
}

export function filterEntries(
  entries: ReclistEntry[],
  query: string,
  filter: SidebarFilter,
  recorded: ReadonlySet<string>
): ReclistEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((entry) => {
    const isRecorded = recorded.has(entry.fileName);
    if (filter === 'recorded' && !isRecorded) return false;
    if (filter === 'unrecorded' && isRecorded) return false;
    if (!q) return true;
    return (
      entry.rawPrompt.toLowerCase().includes(q) ||
      entry.fileName.toLowerCase().includes(q) ||
      (entry.pronunciationHint?.toLowerCase().includes(q) ?? false) ||
      (entry.inlineComment?.toLowerCase().includes(q) ?? false)
    );
  });
}

/** Next unrecorded index after `fromIndex` (wrapping around); `null` when everything is recorded. */
export function findNextUnrecordedIndex(
  entries: ReclistEntry[],
  fromIndex: number,
  recorded: ReadonlySet<string>
): number | null {
  const n = entries.length;
  for (let step = 1; step <= n; step++) {
    const i = (((fromIndex + step) % n) + n) % n;
    const entry = entries[i];
    if (entry && !recorded.has(entry.fileName)) return i;
  }
  return null;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(index)));
}

/** Joins a project root with an optional subfolder, preserving the root's separator style. */
export function joinPath(root: string, ...parts: string[]): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  let out = root.replace(/[\\/]+$/, '');
  for (const part of parts) {
    const clean = part.replace(/^[\\/]+|[\\/]+$/g, '');
    if (clean) out = `${out}${sep}${clean}`;
  }
  return out;
}

export function formatSeconds(durationMs: number): string {
  return (durationMs / 1000).toFixed(1);
}

export function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded)}`;
}
