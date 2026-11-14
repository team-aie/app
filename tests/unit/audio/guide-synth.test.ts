import { describe, expect, it } from 'vitest';
import {
  estimateVocalPitch,
  getMetronomeBeatTimestampsMs,
  synthesizePitchedMetronomeBuffer
} from '@renderer/audio';
import type { ScaleNote } from '@shared/types';

describe('guide-synth — sample-accurate beat grid & pitched harmonic guide synth', () => {
  it('calculates exact lead-in and mora timestamps in milliseconds', () => {
    const schedule = getMetronomeBeatTimestampsMs({
      bpm: 120,
      leadInBeats: 2,
      moraCount: 8
    });
    expect(schedule.leadInMs).toBe(1000);
    expect(schedule.moraTimestampsMs).toEqual([
      1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500
    ]);
    expect(schedule.totalDurationMs).toBe(5000);

    expect(
      getMetronomeBeatTimestampsMs({ bpm: 120, leadInBeats: 0, moraCount: 0 })
    ).toEqual({
      leadInMs: 0,
      moraTimestampsMs: [],
      totalDurationMs: 0
    });

    expect(() =>
      getMetronomeBeatTimestampsMs({ bpm: 0, leadInBeats: 2, moraCount: 4 })
    ).toThrow(RangeError);
  });

  it('places count-in clicks and pitched mora pulses at sample-exact beat indices', () => {
    const sampleRate = 48000;
    const bpm = 128; // Non-integer ms/beat (468.75 ms = 22,500 samples/beat)
    const leadInBeats = 2;
    const moraCount = 4;
    const totalBeats = leadInBeats + moraCount;

    const buffer = synthesizePitchedMetronomeBuffer({
      sampleRate,
      bpm,
      leadInBeats,
      moraCount,
      targetNote: 'G4'
    });

    const expectedTotalSamples = Math.round((totalBeats * 60 * sampleRate) / bpm);
    expect(buffer).toHaveLength(expectedTotalSamples);

    for (let beat = 0; beat < totalBeats; beat++) {
      const exactStartSample = Math.round((beat * 60 * sampleRate) / bpm);

      // Verify clean silence right before every beat (> 0) so pulses never drift across beat boundaries
      if (beat > 0) {
        for (let k = 1; k <= 64; k++) {
          expect(buffer[exactStartSample - k]).toBe(0);
        }
      }

      // Verify crisp onset energy immediately starting at exactStartSample
      let onsetRmsSq = 0;
      const checkWindow = 256;
      for (let n = 0; n < checkWindow; n++) {
        const s = buffer[exactStartSample + n] ?? 0;
        onsetRmsSq += s * s;
      }
      expect(Math.sqrt(onsetRmsSq / checkWindow)).toBeGreaterThan(0.02);
    }

    // Verify safe headroom (zero clipping)
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i] ?? 0);
      if (abs > peak) peak = abs;
    }
    expect(peak).toBeGreaterThan(0.2);
    expect(peak).toBeLessThan(0.5);
  });

  it('synthesizes mora guide pulses locked to the exact target ScaleNote pitch', () => {
    const sampleRate = 44100;
    const bpm = 100; // 600 ms/beat -> > 2048 samples of sustained mora tone
    const notes: ScaleNote[] = ['C3', 'F#4', 'A4'];

    for (const targetNote of notes) {
      const buffer = synthesizePitchedMetronomeBuffer({
        sampleRate,
        bpm,
        leadInBeats: 1,
        moraCount: 2,
        targetNote
      });

      const mora0Start = Math.round((1 * 60 * sampleRate) / bpm);
      // Extract 2048-sample slice right after the 10ms onset tick
      const sustainStart = mora0Start + Math.floor(0.015 * sampleRate);
      const slice = buffer.subarray(sustainStart, sustainStart + 2048);

      const detected = estimateVocalPitch(slice, sampleRate, targetNote);
      expect(detected.noteLabel).toBe(targetNote);
      expect(detected.centsFromTarget).toBe(0);
    }
  });
});
