import wavefilePkg from 'wavefile';
import type { WavFormatConfig } from '@shared/types';

const { WaveFile } = wavefilePkg;

export interface TakeAnalysis {
  durationMs: number;
  peakDb: number;
  clipped: boolean;
  earlyCutoffWarning: boolean;
}

export const SILENCE_FLOOR_DB = -120;
const CLIP_THRESHOLD = 0.999;
const TAIL_WINDOW_MS = 25;
/** Tail RMS above this (dBFS) *and* above 15% of the take peak means the take was chopped mid-sound. */
const CUTOFF_TAIL_RMS_DB = -42;
const CUTOFF_TAIL_PEAK_RATIO = 0.15;

export function toDb(linear: number): number {
  return linear > 0 ? Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(linear)) : SILENCE_FLOOR_DB;
}

/** `x[n] - mean(x)`; returns a new buffer so the caller's samples stay untouched. */
export function removeDcOffset(samples: Float32Array): Float32Array {
  if (samples.length === 0) return new Float32Array(0);
  let sum = 0;
  for (const s of samples) sum += s;
  const mean = sum / samples.length;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = (samples[i] ?? 0) - mean;
  return out;
}

export function analyzeTake(samples: Float32Array, sampleRate: number): TakeAnalysis {
  let peak = 0;
  for (const s of samples) {
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  const tailLength = Math.min(samples.length, Math.max(1, Math.round((TAIL_WINDOW_MS / 1000) * sampleRate)));
  let tailSquares = 0;
  for (let i = samples.length - tailLength; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    tailSquares += s * s;
  }
  const tailRms = samples.length > 0 ? Math.sqrt(tailSquares / tailLength) : 0;
  return {
    durationMs: (samples.length / sampleRate) * 1000,
    peakDb: toDb(peak),
    clipped: peak >= CLIP_THRESHOLD,
    earlyCutoffWarning:
      samples.length > 0 && toDb(tailRms) > CUTOFF_TAIL_RMS_DB && tailRms > peak * CUTOFF_TAIL_PEAK_RATIO
  };
}

type EncodeDepth = '16' | '24' | '32f';
const depthCode = (bitDepth: WavFormatConfig['bitDepth']): EncodeDepth =>
  bitDepth === 16 ? '16' : bitDepth === 24 ? '24' : '32f';

/** Encodes mono samples as a PCM16 / PCM24 / IEEE-float32 RIFF `.wav`. */
export function encodeWav(samples: Float32Array, format: WavFormatConfig): Uint8Array {
  const source = format.removeDcOffset ? removeDcOffset(samples) : samples;
  const depth = depthCode(format.bitDepth);
  let data: Float32Array | Int32Array;
  if (depth === '32f') {
    data = source;
  } else {
    const scale = depth === '16' ? 0x7fff : 0x7fffff;
    data = new Int32Array(source.length);
    for (let i = 0; i < source.length; i++) {
      const clamped = Math.max(-1, Math.min(1, source[i] ?? 0));
      data[i] = Math.round(clamped * scale);
    }
  }
  const wav = new WaveFile();
  wav.fromScratch(1, format.sampleRate, depth, data);
  return wav.toBuffer();
}

/** Decodes any PCM/float `.wav` into mono Float32 (multi-channel files are averaged). */
export function decodeWav(bytes: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const wav = new WaveFile(bytes);
  const sampleRate = (wav.fmt as { sampleRate: number }).sampleRate;
  if (wav.bitDepth !== '32f') wav.toBitDepth('32f');
  const raw: unknown = wav.getSamples(false, Float64Array);
  const channels: ArrayLike<number>[] = Array.isArray(raw) ? (raw as ArrayLike<number>[]) : [raw as ArrayLike<number>];
  const first = channels[0];
  if (!first) return { samples: new Float32Array(0), sampleRate };
  const samples = new Float32Array(first.length);
  for (let i = 0; i < first.length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i] ?? 0;
    samples[i] = sum / channels.length;
  }
  return { samples, sampleRate };
}
