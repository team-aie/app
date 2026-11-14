import type { ReclistEntry } from '@shared/types';
import { normalizeLineEndings } from './encoding';

const DELTA_XSAMPA_TOKENS: ReadonlyArray<
  readonly [token: string, ipa: string, cue?: string]
> = [
  ['ts+', 'tʃ', 'tʃ=chat'],
  ['dz+', 'dʒ', 'dʒ=jam'],
  ['a+', 'ɑ', 'ɑ=father'],
  ['o+', 'ɔ', 'ɔ=thought'],
  ['i+', 'ɪ', 'ɪ=kit'],
  ['u+', 'ʊ', 'ʊ=foot'],
  ['t+', 'θ', 'θ=think'],
  ['d+', 'ð', 'ð=this'],
  ['s+', 'ʃ', 'ʃ=ship'],
  ['z+', 'ʒ', 'ʒ=vision'],
  ['n+', 'ŋ', 'ŋ=sing'],
  ['{', 'æ', 'æ=trap'],
  ['@', 'ə', 'ə=about'],
  ['3', 'ɜː', 'ɜː=bird']
];

const DELTA_VALID_SEGMENT_RE = /^[a-z0-9{@+-]+$/i;

/**
 * Parses an `OREMO-comment.txt` file (`<key>\t<hint>` with space-separated fallback)
 * into a lookup Map supporting exact key, stem-without-`.wav`, and lowercase fallback keys.
 */
export function parseOremoComment(text: string): Map<string, string> {
  const map = new Map<string, string>();
  const normalized = normalizeLineEndings(text.replace(/^\uFEFF/, ''));

  for (const rawLine of normalized.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }

    let key = '';
    let hint = '';

    const tabIndex = rawLine.indexOf('\t');
    if (tabIndex >= 0) {
      key = rawLine.slice(0, tabIndex).trim();
      hint = rawLine.slice(tabIndex + 1).trim();
    } else {
      const spaceMatch = /^(\S+)\s+(.+)$/.exec(trimmed);
      if (spaceMatch) {
        key = spaceMatch[1]!.trim();
        hint = spaceMatch[2]!.trim();
      }
    }

    if (!key || !hint) {
      continue;
    }

    map.set(key, hint);
    const lowerKey = key.toLowerCase();
    if (!map.has(lowerKey)) {
      map.set(lowerKey, hint);
    }

    if (lowerKey.endsWith('.wav')) {
      const stem = key.slice(0, -4);
      const lowerStem = stem.toLowerCase();
      if (stem && !map.has(stem)) {
        map.set(stem, hint);
      }
      if (lowerStem && !map.has(lowerStem)) {
        map.set(lowerStem, hint);
      }
    }
  }

  return map;
}

export function lookupOremoComment(
  commentMap: ReadonlyMap<string, string>,
  entry: Pick<ReclistEntry, 'rawPrompt' | 'fileStem' | 'fileName'>
): string | undefined {
  return (
    commentMap.get(entry.rawPrompt) ??
    commentMap.get(entry.fileStem) ??
    commentMap.get(entry.fileName) ??
    commentMap.get(entry.rawPrompt.toLowerCase()) ??
    commentMap.get(entry.fileStem.toLowerCase()) ??
    commentMap.get(entry.fileName.toLowerCase())
  );
}

/**
 * Converts a Delta English Ver.5 X-SAMPA prompt token (such as `_i+_{_i+` or `_t+i+_t+i+_t+-`)
 * into a human-readable IPA pronunciation hint (e.g. `[ɪ] - [æ] - [ɪ] (ɪ=kit, æ=trap)`).
 */
export function formatDeltaEngXsampaHint(
  rawPrompt: string
): string | undefined {
  const cleaned = rawPrompt.trim().replace(/\.wav$/i, '');
  if (!cleaned.startsWith('_')) {
    return undefined;
  }

  const segments = cleaned.split('_').filter((part) => part.length > 0);
  if (
    segments.length === 0 ||
    !segments.every((seg) => DELTA_VALID_SEGMENT_RE.test(seg))
  ) {
    return undefined;
  }

  const cues: string[] = [];
  const seenCues = new Set<string>();

  const ipaParts = segments.map((seg) => {
    let ipa = '';
    let i = 0;
    while (i < seg.length) {
      let matched = false;
      for (const [token, symbol, cue] of DELTA_XSAMPA_TOKENS) {
        if (seg.startsWith(token, i)) {
          ipa += symbol;
          if (cue && !seenCues.has(cue)) {
            seenCues.add(cue);
            cues.push(cue);
          }
          i += token.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        ipa += seg[i]!;
        i++;
      }
    }
    return `[${ipa}]`;
  });

  const baseHint = ipaParts.join(' - ');
  if (cues.length === 0) {
    return baseHint;
  }
  return `${baseHint} (${cues.join(', ')})`;
}
