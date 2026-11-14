import { scaleNoteToFrequencyHz } from '@shared/music/chromatic';
import type { ScaleNote } from '@shared/types';

export interface MetronomeTimingParams {
  bpm: number;
  leadInBeats: number;
  moraCount: number;
}

export interface MetronomeBeatSchedule {
  leadInMs: number;
  moraTimestampsMs: number[];
  totalDurationMs: number;
}

export interface PitchedMetronomeSynthParams extends MetronomeTimingParams {
  sampleRate: number;
  targetNote: ScaleNote;
}

/**
 * Computes exact millisecond beat timestamps for lead-in count-in and mora guide pulses
 * (`60,000 / bpm` ms per beat) so multi-mora VCV/CVVC prompts align 1:1 with `oto.ini` grids.
 */
export function getMetronomeBeatTimestampsMs(
  params: MetronomeTimingParams
): MetronomeBeatSchedule {
  if (!Number.isFinite(params.bpm) || params.bpm <= 0) {
    throw new RangeError(`Invalid metronome BPM: ${String(params.bpm)}`);
  }

  const leadInBeats = Math.max(0, Math.floor(params.leadInBeats));
  const moraCount = Math.max(0, Math.floor(params.moraCount));

  const leadInMs = (leadInBeats * 60_000) / params.bpm;
  const moraTimestampsMs: number[] = [];
  for (let m = 0; m < moraCount; m++) {
    moraTimestampsMs.push(((leadInBeats + m) * 60_000) / params.bpm);
  }
  const totalBeats = leadInBeats + moraCount;
  const totalDurationMs =
    totalBeats === 0 ? 0 : (totalBeats * 60_000) / params.bpm;

  // Avoid -0
  return {
    leadInMs: leadInMs === 0 ? 0 : leadInMs,
    moraTimestampsMs,
    totalDurationMs: totalDurationMs === 0 ? 0 : totalDurationMs
  };
}

/**
 * Synthesizes a mono `Float32Array` buffer containing crisp count-in clicks (`leadInBeats`)
 * followed by warm, pitched harmonic mora guide pulses (`moraCount`) locked to `targetNote`
 * at sample-exact beat positions (`Math.round((beat * 60 * sampleRate) / bpm)`).
 */
export function synthesizePitchedMetronomeBuffer(
  params: PitchedMetronomeSynthParams
): Float32Array {
  if (!Number.isFinite(params.sampleRate) || params.sampleRate <= 0) {
    throw new RangeError(
      `Invalid metronome sampleRate: ${String(params.sampleRate)}`
    );
  }
  if (!Number.isFinite(params.bpm) || params.bpm <= 0) {
    throw new RangeError(`Invalid metronome BPM: ${String(params.bpm)}`);
  }

  const sampleRate = params.sampleRate;
  const bpm = params.bpm;
  const leadInBeats = Math.max(0, Math.floor(params.leadInBeats));
  const moraCount = Math.max(0, Math.floor(params.moraCount));
  const totalBeats = leadInBeats + moraCount;

  if (totalBeats === 0) {
    return new Float32Array(0);
  }

  const totalSamples = Math.round((totalBeats * 60 * sampleRate) / bpm);
  const buffer = new Float32Array(totalSamples);
  const targetFreqHz = scaleNoteToFrequencyHz(params.targetNote);
  const nyquist = sampleRate * 0.48;

  for (let beat = 0; beat < totalBeats; beat++) {
    const startSample = Math.round((beat * 60 * sampleRate) / bpm);
    const nextBeatSample = Math.round(((beat + 1) * 60 * sampleRate) / bpm);
    const slotSamples = Math.max(
      0,
      Math.min(totalSamples, nextBeatSample) - startSample
    );
    if (slotSamples <= 1) {
      continue;
    }

    if (beat < leadInBeats) {
      // Crisp pitched woodblock count-in click (accented on beat 0)
      const isDownbeat = beat === 0;
      const clickFreqHz = Math.min(nyquist, isDownbeat ? 1320 : 990);
      const clickGain = isDownbeat ? 0.36 : 0.26;
      const clickSamples = Math.max(
        2,
        Math.min(Math.floor(0.036 * sampleRate), Math.floor(slotSamples * 0.8))
      );
      const attackSamples = Math.max(1, Math.floor(0.0015 * sampleRate));

      for (let n = 0; n < clickSamples; n++) {
        const idx = startSample + n;
        if (idx >= totalSamples) {
          break;
        }
        const t = n / sampleRate;
        const progress = n / clickSamples;
        const attack =
          n < attackSamples
            ? 0.5 * (1 - Math.cos((Math.PI * (n + 1)) / attackSamples))
            : 1;
        const decay = (1 - progress) * Math.exp(-6.5 * progress);
        const carrier =
          0.8 * Math.sin(2 * Math.PI * clickFreqHz * t) +
          (clickFreqHz * 2 < nyquist
            ? 0.2 * Math.sin(4 * Math.PI * clickFreqHz * t)
            : 0);
        buffer[idx] =
          (buffer[idx] ?? 0) + clickGain * attack * decay * carrier;
      }
    } else {
      // Soft harmonic vocal guide pulse locked to targetNote (accented on mora 0 entry)
      const moraIndex = beat - leadInBeats;
      const isEntryMora = moraIndex === 0;
      const pulseGain = isEntryMora ? 0.34 : 0.24;
      const pulseSamples = Math.max(
        4,
        Math.min(Math.floor(0.32 * sampleRate), Math.floor(slotSamples * 0.78))
      );
      const attackSamples = Math.max(2, Math.floor(0.004 * sampleRate));
      const h2Weight = targetFreqHz * 2 < nyquist ? 0.28 : 0;
      const h3Weight = targetFreqHz * 3 < nyquist ? 0.1 : 0;
      const normFactor = 1 / (1 + h2Weight + h3Weight);

      for (let n = 0; n < pulseSamples; n++) {
        const idx = startSample + n;
        if (idx >= totalSamples) {
          break;
        }
        const t = n / sampleRate;
        const progress = n / pulseSamples;
        const attack =
          n < attackSamples
            ? 0.5 * (1 - Math.cos((Math.PI * (n + 1)) / attackSamples))
            : 1;
        const envelope = attack * (1 - progress) * Math.exp(-3.0 * progress);

        let harmonicSum = Math.sin(2 * Math.PI * targetFreqHz * t);
        if (h2Weight > 0) {
          harmonicSum += h2Weight * Math.sin(4 * Math.PI * targetFreqHz * t);
        }
        if (h3Weight > 0) {
          harmonicSum += h3Weight * Math.sin(6 * Math.PI * targetFreqHz * t);
        }

        // Subtle onset tick in the first 10ms so beat boundary stays crisp under singing
        const tickFreq = targetFreqHz * 4;
        const onsetTick =
          tickFreq < nyquist && t < 0.01
            ? 0.12 *
              Math.exp(-t / 0.0025) *
              Math.sin(2 * Math.PI * tickFreq * t)
            : 0;

        const sampleValue =
          pulseGain * envelope * (harmonicSum * normFactor + onsetTick);
        const combined = (buffer[idx] ?? 0) + sampleValue;
        buffer[idx] = Math.max(-1, Math.min(1, combined));
      }
    }
  }

  return buffer;
}
