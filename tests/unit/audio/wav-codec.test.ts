import { WaveFile } from 'wavefile';
import { describe, expect, it } from 'vitest';
import {
  MIN_DBFS,
  analyzeTakeSignal,
  decodeWavBytes,
  encodeWavBytes,
  removeDcOffset
} from '@renderer/audio';
import type { SampleRateHz, WavBitDepth } from '@shared/types';

describe('wav-codec — DC offset, take hygiene, and lossless WAV round-trips', () => {
  it('removes DC offset accurately without mutating input or failing on empty buffers', () => {
    const empty = removeDcOffset(new Float32Array(0));
    expect(empty).toHaveLength(0);

    const sampleRate = 48000;
    const length = 24000; // 500 ms
    const dcBias = -0.1375;
    const original = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      original[i] =
        0.42 * Math.sin(2 * Math.PI * 440 * t) +
        0.16 * Math.sin(2 * Math.PI * 880 * t) +
        dcBias;
    }

    const cleaned = removeDcOffset(original);
    expect(cleaned).toHaveLength(length);
    // Input remains untouched
    expect(original[0]).toBeCloseTo(dcBias, 5);

    let meanAfter = 0;
    for (let i = 0; i < length; i++) {
      meanAfter += cleaned[i] ?? 0;
    }
    meanAfter /= length;
    expect(Math.abs(meanAfter)).toBeLessThan(1e-7);

    // AC component preserved
    for (let i = 0; i < 500; i++) {
      expect((cleaned[i] ?? 0) - ((original[i] ?? 0) - dcBias)).toBeCloseTo(
        0,
        5
      );
    }
  });

  it('detects >= -0.1 dBFS clipping and trailing 40 ms early-cutoff warnings', () => {
    expect(analyzeTakeSignal(new Float32Array(0), 44100)).toEqual({
      durationMs: 0,
      rmsDb: MIN_DBFS,
      peakDb: MIN_DBFS,
      clipped: false,
      earlyCutoffWarning: false
    });

    const sampleRate = 44100;
    const halfSecSamples = sampleRate / 2;

    // 1. Clean decaying vowel peaking at -3 dBFS (~0.7079), exponentially decaying into quiet room tone over last 120 ms
    const cleanTake = new Float32Array(halfSecSamples);
    const releaseSamples = Math.floor(sampleRate * 0.12);
    for (let i = 0; i < halfSecSamples; i++) {
      const t = i / sampleRate;
      const tailRemain = halfSecSamples - 1 - i;
      const env =
        tailRemain < releaseSamples
          ? Math.exp(-6 * (1 - tailRemain / releaseSamples))
          : 1;
      cleanTake[i] = 0.7079 * env * Math.sin(2 * Math.PI * 261.63 * t);
    }
    const cleanReport = analyzeTakeSignal(cleanTake, sampleRate);
    expect(cleanReport.durationMs).toBeCloseTo(500, 3);
    expect(cleanReport.clipped).toBe(false);
    expect(cleanReport.earlyCutoffWarning).toBe(false);
    expect(cleanReport.peakDb).toBeCloseTo(-3.0, 1);

    // 2. Just below clipping (-0.2 dBFS -> amp ~0.9772) vs clipped (-0.05 dBFS -> amp ~0.9943)
    const unclippedHot = new Float32Array(4410);
    unclippedHot[100] = 10 ** (-0.2 / 20);
    expect(analyzeTakeSignal(unclippedHot, sampleRate).clipped).toBe(false);

    const clippedHot = new Float32Array(4410);
    clippedHot[100] = -(10 ** (-0.05 / 20));
    expect(analyzeTakeSignal(clippedHot, sampleRate).clipped).toBe(true);

    // 3. Abruptly chopped vowel where trailing 40 ms still has ~ -14 dBFS RMS (> -28 dBFS)
    const choppedTake = new Float32Array(halfSecSamples);
    for (let i = 0; i < halfSecSamples; i++) {
      const t = i / sampleRate;
      choppedTake[i] = 0.28 * Math.sin(2 * Math.PI * 330 * t);
    }
    const choppedReport = analyzeTakeSignal(choppedTake, sampleRate);
    expect(choppedReport.clipped).toBe(false);
    expect(choppedReport.earlyCutoffWarning).toBe(true);
  });

  it('round-trips 16-bit PCM, 24-bit PCM, and 32-bit IEEE Float WAVs at 44.1 kHz & 48 kHz', () => {
    const sampleRates: SampleRateHz[] = [44100, 48000];
    const bitDepths: WavBitDepth[] = [16, 24, 32];

    for (const sampleRate of sampleRates) {
      const numSamples = Math.floor(sampleRate * 0.1);
      const signal = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        signal[i] =
          0.65 * Math.sin(2 * Math.PI * 440 * t) +
          0.2 * Math.cos(2 * Math.PI * 1320 * t);
      }
      // Include sub-microvolt scientific-notation sample to guard against parseInt('1e-8') bugs
      signal[0] = 1e-9;
      signal[1] = -1e-9;

      for (const bitDepth of bitDepths) {
        const bytes = encodeWavBytes(signal, {
          sampleRate,
          bitDepth,
          removeDcOffset: false
        });
        expect(bytes.byteLength).toBeGreaterThan(44);

        const decoded = decodeWavBytes(bytes);
        expect(decoded.sampleRate).toBe(sampleRate);
        expect(decoded.bitDepth).toBe(bitDepth);
        expect(decoded.samples).toHaveLength(numSamples);

        const maxTolerance =
          bitDepth === 32 ? 0 : bitDepth === 24 ? 2e-7 : 3.5e-5;

        let maxAbsDiff = 0;
        for (let i = 0; i < numSamples; i++) {
          const diff = Math.abs((decoded.samples[i] ?? 0) - (signal[i] ?? 0));
          if (diff > maxAbsDiff) {
            maxAbsDiff = diff;
          }
        }
        expect(maxAbsDiff).toBeLessThanOrEqual(maxTolerance);
      }
    }
  });

  it('applies automatic DC-offset removal during encodeWavBytes when configured and clamps > 0 dBFS safely', () => {
    const biased = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const strippedBytes = encodeWavBytes(biased, {
      sampleRate: 48000,
      bitDepth: 16,
      removeDcOffset: true
    });
    const decodedStripped = decodeWavBytes(strippedBytes);
    for (const s of decodedStripped.samples) {
      expect(s).toBe(0);
    }

    // Over-unity samples clamp cleanly to [-1, 1] without integer wrap-around
    const overRange = new Float32Array([1.35, -1.42, 0]);
    const clampedBytes = encodeWavBytes(overRange, {
      sampleRate: 44100,
      bitDepth: 24,
      removeDcOffset: false
    });
    const decodedClamped = decodeWavBytes(clampedBytes);
    expect(decodedClamped.samples[0]).toBeCloseTo(1, 5);
    expect(decodedClamped.samples[1]).toBeCloseTo(-1, 5);
    expect(decodedClamped.samples[2]).toBe(0);
  });

  it('downmixes stereo WAV files cleanly to mono during decodeWavBytes', () => {
    const wav = new WaveFile();
    const left = new Int16Array([16384, -16384]); // ~ +0.5, -0.5
    const right = new Int16Array([0, -16384]); // 0.0, -0.5
    wav.fromScratch(2, 44100, '16', [left, right]);

    const decoded = decodeWavBytes(wav.toBuffer());
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.bitDepth).toBe(16);
    expect(decoded.samples).toHaveLength(2);
    expect(decoded.samples[0]).toBeCloseTo(0.25, 3);
    expect(decoded.samples[1]).toBeCloseTo(-0.5, 3);
  });
});
