import { describe, expect, it } from 'vitest';
import {
  SPECTRUM_BAND_COUNT,
  SPECTRUM_MAX_HZ,
  SPECTRUM_MIN_HZ,
  computeVocalSpectrum64,
  downsampleWaveformSlice,
  estimateVocalPitch
} from '@renderer/audio';
import { scaleNoteToFrequencyHz } from '@shared/music/chromatic';
import type { ScaleNote } from '@shared/types';

function synthesizeHarmonicVoice(
  freqHz: number,
  sampleRate: number,
  length: number
): Float32Array {
  const frame = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    frame[i] =
      0.55 * Math.sin(2 * Math.PI * freqHz * t) +
      0.22 * Math.sin(4 * Math.PI * freqHz * t) +
      0.1 * Math.sin(6 * Math.PI * freqHz * t);
  }
  return frame;
}

function frequencyToExpectedBandIndex(freqHz: number): number {
  const ratio = Math.log(freqHz / SPECTRUM_MIN_HZ) /
    Math.log(SPECTRUM_MAX_HZ / SPECTRUM_MIN_HZ);
  return Math.floor(SPECTRUM_BAND_COUNT * ratio);
}

describe('dsp-analysis — pitchy vocal F0 tracker & 64-band radix-2 FFT spectrogram', () => {
  it('tracks vocal fundamental frequency & cents accurately across C3, F#4, and A4', () => {
    const testCases: Array<{ note: ScaleNote; sampleRate: number }> = [
      { note: 'C3', sampleRate: 44100 },
      { note: 'F#4', sampleRate: 48000 },
      { note: 'A4', sampleRate: 44100 },
      { note: 'G2', sampleRate: 48000 }
    ];

    for (const { note, sampleRate } of testCases) {
      const targetHz = scaleNoteToFrequencyHz(note);
      const frame = synthesizeHarmonicVoice(targetHz, sampleRate, 2048);
      const estimate = estimateVocalPitch(frame, sampleRate, note);

      expect(estimate.frequencyHz).not.toBeNull();
      expect(estimate.frequencyHz!).toBeCloseTo(targetHz, 0);
      expect(estimate.noteLabel).toBe(note);
      expect(estimate.centsFromTarget).toBe(0);
      expect(estimate.clarity).toBeGreaterThan(0.9);
    }
  });

  it('computes accurate signed cents deviation when singing sharp or flat', () => {
    const sampleRate = 48000;
    const sharp25CentsHz = 440 * 2 ** (25 / 1200);
    const flat33CentsHz = 440 * 2 ** (-33 / 1200);

    const sharpEst = estimateVocalPitch(
      synthesizeHarmonicVoice(sharp25CentsHz, sampleRate, 2048),
      sampleRate,
      'A4'
    );
    expect(sharpEst.noteLabel).toBe('A4');
    expect(Math.abs((sharpEst.centsFromTarget ?? 0) - 25)).toBeLessThanOrEqual(
      1
    );

    const flatEst = estimateVocalPitch(
      synthesizeHarmonicVoice(flat33CentsHz, sampleRate, 2048),
      sampleRate,
      'A4'
    );
    expect(flatEst.noteLabel).toBe('A4');
    expect(Math.abs((flatEst.centsFromTarget ?? 0) - -33)).toBeLessThanOrEqual(
      1
    );
  });

  it('gates silence, DC-only buffers, white noise, and frequencies outside 55–1,200 Hz', () => {
    const sampleRate = 44100;

    // Silence
    expect(
      estimateVocalPitch(new Float32Array(2048), sampleRate, 'A4').frequencyHz
    ).toBeNull();

    // Strong constant DC offset with zero AC energy
    const dcOnly = new Float32Array(2048).fill(0.45);
    expect(estimateVocalPitch(dcOnly, sampleRate, 'A4').frequencyHz).toBeNull();

    // Below 55 Hz (32 Hz rumble)
    const subBass = synthesizeHarmonicVoice(32, sampleRate, 4096);
    expect(estimateVocalPitch(subBass, sampleRate, 'C2').frequencyHz).toBeNull();

    // Above 1,200 Hz (1,760 Hz A6 whistle)
    const whistle = new Float32Array(2048);
    for (let i = 0; i < whistle.length; i++) {
      whistle[i] = 0.5 * Math.sin((2 * Math.PI * 1760 * i) / sampleRate);
    }
    expect(estimateVocalPitch(whistle, sampleRate, 'A5').frequencyHz).toBeNull();

    // Deterministic LCG white noise (unvoiced fricative)
    const noise = new Float32Array(2048);
    let seed = 123456789;
    for (let i = 0; i < noise.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      noise[i] = (seed / 0xffffffff) * 0.6 - 0.3;
    }
    expect(estimateVocalPitch(noise, sampleRate, 'A4').frequencyHz).toBeNull();
  });

  it('maps synthetic vocal formants into 64 normalized [0..1] log-frequency bands', () => {
    const sampleRate = 48000;
    const silenceBands = computeVocalSpectrum64(
      new Float32Array(2048),
      sampleRate
    );
    expect(silenceBands).toHaveLength(SPECTRUM_BAND_COUNT);
    expect(silenceBands.every((v) => v === 0)).toBe(true);

    // Synthetic /a/ formants: F1 = 730 Hz, F2 = 1090 Hz, F3 = 2440 Hz
    const formantsHz = [730, 1090, 2440];
    const frame = new Float32Array(4096);
    for (let i = 0; i < frame.length; i++) {
      const t = i / sampleRate;
      frame[i] =
        0.5 * Math.sin(2 * Math.PI * 730 * t) +
        0.35 * Math.sin(2 * Math.PI * 1090 * t) +
        0.25 * Math.sin(2 * Math.PI * 2440 * t);
    }

    const bands = computeVocalSpectrum64(frame, sampleRate);
    expect(bands).toHaveLength(64);
    for (const value of bands) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }

    for (const freqHz of formantsHz) {
      const expectedIdx = frequencyToExpectedBandIndex(freqHz);
      const neighborhoodPeak = Math.max(
        bands[Math.max(0, expectedIdx - 1)] ?? 0,
        bands[expectedIdx] ?? 0,
        bands[Math.min(63, expectedIdx + 1)] ?? 0
      );
      expect(neighborhoodPeak).toBeGreaterThan(0.8);
    }

    // Low unused band (~80 Hz) and high band (~6800 Hz) stay near zero
    expect(bands[3] ?? 1).toBeLessThan(0.05);
    expect(bands[61] ?? 1).toBeLessThan(0.05);
  });

  it('preserves peak polarity when downsampling oscilloscope slices', () => {
    const raw = new Float32Array(2048);
    raw[301] = 0.94;
    raw[1405] = -0.88;
    const slice = downsampleWaveformSlice(raw, 256);
    expect(slice).toHaveLength(256);
    expect(Math.max(...slice)).toBeCloseTo(0.94, 4);
    expect(Math.min(...slice)).toBeCloseTo(-0.88, 4);
  });

  it('detects noisy / breathy / subharmonic-modulated G4 (392 Hz + 0.20 * 196 Hz + white noise) as G4 (~392 Hz) and never G3', () => {
    for (const sampleRate of [44100, 48000]) {
      let seed = 20261114;
      const nextWhite = (): number => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return (seed / 0xffffffff) * 2 - 1;
      };

      // (a) Direct G4 (392 Hz) + 20% 196 Hz subharmonic + room white noise across multiple frames
      for (let trial = 0; trial < 12; trial++) {
        const frame = new Float32Array(2048);
        for (let i = 0; i < frame.length; i++) {
          const t = i / sampleRate;
          frame[i] =
            0.85 * Math.sin(2 * Math.PI * 392 * t) +
            0.2 * Math.sin(2 * Math.PI * 196 * t) +
            0.18 * nextWhite();
        }
        const est = estimateVocalPitch(frame, sampleRate, 'G4');
        expect(est.frequencyHz).not.toBeNull();
        expect(est.noteLabel).toBe('G4');
        expect(Math.abs((est.frequencyHz ?? 0) - 392)).toBeLessThan(5);
        expect(Math.abs(est.centsFromTarget ?? 999)).toBeLessThanOrEqual(20);
      }

      // (b) Harmonic G4 (392 Hz + 784 Hz) + 20% 196 Hz subharmonic + breathy room noise
      const breathyHarmonicG4 = new Float32Array(2048);
      for (let i = 0; i < breathyHarmonicG4.length; i++) {
        const t = i / sampleRate;
        breathyHarmonicG4[i] =
          0.65 * Math.sin(2 * Math.PI * 392 * t) +
          0.25 * Math.sin(2 * Math.PI * 784 * t) +
          0.2 * Math.sin(2 * Math.PI * 196 * t) +
          0.16 * nextWhite();
      }
      const breathyEst = estimateVocalPitch(breathyHarmonicG4, sampleRate, 'G4');
      expect(breathyEst.noteLabel).toBe('G4');
      expect(Math.abs((breathyEst.frequencyHz ?? 0) - 392)).toBeLessThan(5);

      // (c) Heavy odd/even period modulation (~33% 196 Hz subharmonic) where raw MPM locks onto 196 Hz
      const subharmonicLockedG4 = new Float32Array(2048);
      for (let i = 0; i < subharmonicLockedG4.length; i++) {
        const t = i / sampleRate;
        subharmonicLockedG4[i] =
          1.0 * Math.sin(2 * Math.PI * 392 * t) +
          0.33 * Math.sin(2 * Math.PI * 196 * t) +
          0.12 * nextWhite();
      }
      const disambiguatedEst = estimateVocalPitch(
        subharmonicLockedG4,
        sampleRate,
        'G4'
      );
      expect(disambiguatedEst.noteLabel).toBe('G4');
      expect(Math.abs((disambiguatedEst.frequencyHz ?? 0) - 392)).toBeLessThan(5);
    }
  });

  it('keeps pure and rich harmonic G3 (196 Hz + 0.6 * 392 Hz + 0.35 * 588 Hz) locked at G3 (~196 Hz) and preserves A4 & noise rejection', () => {
    for (const sampleRate of [44100, 48000]) {
      // Pure 196 Hz G3
      const pureG3 = new Float32Array(2048);
      for (let i = 0; i < pureG3.length; i++) {
        const t = i / sampleRate;
        pureG3[i] = 0.8 * Math.sin(2 * Math.PI * 196 * t);
      }
      const pureEst = estimateVocalPitch(pureG3, sampleRate, 'G3');
      expect(pureEst.noteLabel).toBe('G3');
      expect(Math.abs((pureEst.frequencyHz ?? 0) - 196)).toBeLessThan(2);

      // Rich harmonic G3 (196 Hz + 0.6 * 392 Hz + 0.35 * 588 Hz) + room noise
      let seed = 987654321;
      const nextWhite = (): number => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return (seed / 0xffffffff) * 2 - 1;
      };
      const richG3 = new Float32Array(2048);
      const noisyRichG3 = new Float32Array(2048);
      for (let i = 0; i < richG3.length; i++) {
        const t = i / sampleRate;
        const clean =
          1.0 * Math.sin(2 * Math.PI * 196 * t) +
          0.6 * Math.sin(2 * Math.PI * 392 * t) +
          0.35 * Math.sin(2 * Math.PI * 588 * t);
        richG3[i] = clean;
        noisyRichG3[i] = clean + 0.14 * nextWhite();
      }

      const richEst = estimateVocalPitch(richG3, sampleRate, 'G3');
      expect(richEst.noteLabel).toBe('G3');
      expect(Math.abs((richEst.frequencyHz ?? 0) - 196)).toBeLessThan(2);

      const noisyRichEst = estimateVocalPitch(noisyRichG3, sampleRate, 'G3');
      expect(noisyRichEst.noteLabel).toBe('G3');
      expect(Math.abs((noisyRichEst.frequencyHz ?? 0) - 196)).toBeLessThan(3);

      // Even when targetNote is G4, singing a genuine rich G3 reports G3 (-1200 cents), never G4!
      const g3AgainstG4Target = estimateVocalPitch(richG3, sampleRate, 'G4');
      expect(g3AgainstG4Target.noteLabel).toBe('G3');
      expect(
        Math.abs((g3AgainstG4Target.centsFromTarget ?? 0) - -1200)
      ).toBeLessThanOrEqual(5);

      // A4 (440 Hz) and unvoiced breath/fricative noise rejection
      const a4Est = estimateVocalPitch(
        synthesizeHarmonicVoice(440, sampleRate, 2048),
        sampleRate,
        'A4'
      );
      expect(a4Est.noteLabel).toBe('A4');
      expect(Math.abs((a4Est.frequencyHz ?? 0) - 440)).toBeLessThan(2);

      const breathNoise = new Float32Array(2048);
      let lp = 0;
      for (let i = 0; i < breathNoise.length; i++) {
        lp = 0.85 * lp + 0.15 * nextWhite();
        breathNoise[i] = lp * 0.5;
      }
      expect(
        estimateVocalPitch(breathNoise, sampleRate, 'G4').frequencyHz
      ).toBeNull();
    }
  });
});
