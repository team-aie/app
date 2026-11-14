import {
  type OctaveNumber,
  PITCH_CLASSES,
  type PitchClass,
  type ScaleNote
} from '@shared/types';

export const OCTAVES: readonly OctaveNumber[] = [2, 3, 4, 5] as const;

export const ALL_SCALE_NOTES: readonly ScaleNote[] = OCTAVES.flatMap((octave) =>
  PITCH_CLASSES.map((pitch): ScaleNote => `${pitch}${octave}`)
);

export function scaleNoteToMidi(note: ScaleNote): number {
  const octave = Number(note.slice(-1)) as OctaveNumber;
  const pitch = note.slice(0, -1) as PitchClass;
  const semitone = PITCH_CLASSES.indexOf(pitch);
  if (semitone < 0 || Number.isNaN(octave)) {
    throw new Error(`Invalid ScaleNote: ${note}`);
  }
  return (octave + 1) * 12 + semitone;
}

export function scaleNoteToFrequencyHz(note: ScaleNote): number {
  const midi = scaleNoteToMidi(note);
  return 440 * 2 ** ((midi - 69) / 12);
}

export function frequencyHzToPitchDelta(
  frequencyHz: number,
  targetNote: ScaleNote
): {
  midiNote: number;
  noteLabel: string;
  centsFromTarget: number;
} {
  const exactMidi = 69 + 12 * Math.log2(frequencyHz / 440);
  const nearestMidi = Math.round(exactMidi);
  const pitchIndex = ((nearestMidi % 12) + 12) % 12;
  const octave = Math.floor(nearestMidi / 12) - 1;
  const noteLabel = `${PITCH_CLASSES[pitchIndex]}${octave}`;
  const targetMidi = scaleNoteToMidi(targetNote);
  const centsFromTarget = Math.round((exactMidi - targetMidi) * 100);
  return {
    midiNote: nearestMidi,
    noteLabel,
    centsFromTarget
  };
}
