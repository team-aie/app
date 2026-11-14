import { stringify } from 'yaml';
import { PITCH_CLASSES, type AieProjectManifest, type ReclistManifest } from '@shared/types';
import { scaleNoteToMidi } from '@shared/music/chromatic';

const LOWEST_MIDI = 24; // C1
const HIGHEST_MIDI = 107; // B7

export function midiToNoteName(midi: number): string {
  const pitch = PITCH_CLASSES[((midi % 12) + 12) % 12] ?? 'C';
  return `${pitch}${Math.floor(midi / 12) - 1}`;
}

/**
 * Splits the keyboard into contiguous OpenUtau `tone_ranges`, one per pitch
 * subbank, with boundaries halfway between neighbouring target notes.
 */
export function computeToneRanges(midis: number[]): string[] {
  const sorted = [...midis].sort((a, b) => a - b);
  return sorted.map((midi, index) => {
    const prev = sorted[index - 1];
    const next = sorted[index + 1];
    const low = prev === undefined ? LOWEST_MIDI : Math.floor((prev + midi) / 2) + 1;
    const high = next === undefined ? HIGHEST_MIDI : Math.floor((midi + next) / 2);
    return `${midiToNoteName(low)}-${midiToNoteName(high)}`;
  });
}

/** Read-only preview of the root `character.yaml` aie keeps in sync. */
export function buildCharacterYamlPreview(
  manifest: AieProjectManifest,
  builtins: ReclistManifest[]
): string {
  const firstBuiltin = manifest.sets
    .map((set) => {
      const source = set.reclistSource;
      return source.kind === 'builtin'
        ? builtins.find((candidate) => candidate.id === source.builtinId)
        : undefined;
    })
    .find(Boolean);
  const defaultPhonemizer = manifest.defaultPhonemizer ?? firstBuiltin?.defaultPhonemizer;

  const pitched = manifest.sets.map((set) => ({ set, midi: scaleNoteToMidi(set.scale) }));
  const uniqueMidis = [...new Set(pitched.map((entry) => entry.midi))].sort((a, b) => a - b);
  const ranges = computeToneRanges(uniqueMidis);
  const rangeByMidi = new Map(uniqueMidis.map((midi, index) => [midi, ranges[index] ?? '']));

  const doc: Record<string, unknown> = {
    text_file_encoding: 'utf-8',
    singer_type: 'utau',
    name: manifest.name
  };
  if (manifest.author) {
    doc['author'] = manifest.author;
  }
  if (defaultPhonemizer) {
    doc['default_phonemizer'] = defaultPhonemizer;
  }
  doc['subbanks'] = pitched
    .sort((a, b) => a.midi - b.midi)
    .map(({ set, midi }) => ({
      color: '',
      prefix: '',
      suffix: set.aliasSuffix,
      tone_ranges: [rangeByMidi.get(midi) ?? '']
    }));
  return stringify(doc);
}
