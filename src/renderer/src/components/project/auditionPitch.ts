import type { ScaleNote } from '@shared/types';
import { scaleNoteToFrequencyHz } from '@shared/music/chromatic';

export interface AuditionHandle {
  stop(): void;
  /** Resolves when the tone has finished (or was stopped). */
  finished: Promise<void>;
}

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let sharedContext: AudioContext | null = null;

/**
 * Plays a short, clean harmonic reference tone for `note` (fundamental plus
 * gently decaying partials, soft attack/release). Pure WebAudio, no effects.
 */
export function playAuditionTone(
  note: ScaleNote,
  options: { durationMs?: number; outputDeviceId?: string } = {}
): AuditionHandle | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) {
    return null;
  }
  sharedContext ??= new Ctor();
  const ctx = sharedContext;
  void ctx.resume();
  const sinkCapable = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
  if (options.outputDeviceId && options.outputDeviceId !== 'default' && sinkCapable.setSinkId) {
    void sinkCapable.setSinkId(options.outputDeviceId).catch(() => undefined);
  }

  const durationS = (options.durationMs ?? 1400) / 1000;
  const frequency = scaleNoteToFrequencyHz(note);
  const real = new Float32Array([0, 1, 0.42, 0.22, 0.12, 0.06]);
  const imag = new Float32Array(real.length);
  const wave = ctx.createPeriodicWave(real, imag);

  const osc = ctx.createOscillator();
  osc.setPeriodicWave(wave);
  osc.frequency.value = frequency;

  const gain = ctx.createGain();
  const t0 = ctx.currentTime;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.22, t0 + 0.04);
  gain.gain.setValueAtTime(0.22, t0 + Math.max(0.05, durationS - 0.25));
  gain.gain.linearRampToValueAtTime(0, t0 + durationS);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationS + 0.02);

  let resolveFinished: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    resolveFinished();
  };

  return {
    stop() {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.03);
      try {
        osc.stop(now + 0.04);
      } catch {
        resolveFinished();
      }
    },
    finished
  };
}
