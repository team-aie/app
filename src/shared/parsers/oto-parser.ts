import type { OtoEntry, ReclistEntry } from '@shared/types';
import { normalizeLineEndings } from './encoding';

function extractBaseFileName(filePathOrName: string): string {
  const normalized = filePathOrName.replace(/\\/g, '/');
  const slashIdx = normalized.lastIndexOf('/');
  return slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
}

function extractFileStem(fileName: string): string {
  const baseName = extractBaseFileName(fileName);
  return baseName.replace(/\.wav$/i, '');
}

/**
 * Parses UTAU `oto.ini` text (`<fileName>=<alias>,<offset>,<consonant>,<cutoff>,<preutterance>,<overlap>`).
 */
export function parseOtoIni(text: string): OtoEntry[] {
  const entries: OtoEntry[] = [];
  const normalized = normalizeLineEndings(text.replace(/^\uFEFF/, ''));

  for (const rawLine of normalized.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    const lower = trimmed.toLowerCase();
    const wavEqIdx = lower.indexOf('.wav=');
    const eqIdx = wavEqIdx >= 0 ? wavEqIdx + 4 : trimmed.indexOf('=');
    if (eqIdx <= 0) {
      continue;
    }

    const rawFileName = trimmed.slice(0, eqIdx).trim();
    const rhs = trimmed.slice(eqIdx + 1);
    const parts = rhs.split(',');
    if (!rawFileName || parts.length < 6) {
      continue;
    }

    const alias = parts[0]!.trim();
    const offsetMs = Number(parts[1]!.trim());
    const consonantMs = Number(parts[2]!.trim());
    const cutoffMs = Number(parts[3]!.trim());
    const preutteranceMs = Number(parts[4]!.trim());
    const overlapMs = Number(parts[5]!.trim());

    if (
      !Number.isFinite(offsetMs) ||
      !Number.isFinite(consonantMs) ||
      !Number.isFinite(cutoffMs) ||
      !Number.isFinite(preutteranceMs) ||
      !Number.isFinite(overlapMs)
    ) {
      continue;
    }

    const normalizedFileName = rawFileName.replace(/\\/g, '/');
    const fileName = /\.wav$/i.test(normalizedFileName)
      ? normalizedFileName
      : `${normalizedFileName}.wav`;

    entries.push({
      fileName,
      alias,
      offsetMs,
      consonantMs,
      cutoffMs,
      preutteranceMs,
      overlapMs
    });
  }

  return entries;
}

function applyAliasSuffix(
  rawAlias: string,
  fileName: string,
  suffix: string
): string {
  const trimmedAlias = rawAlias.trim();
  if (!suffix) {
    return trimmedAlias;
  }

  const baseAlias = trimmedAlias || extractFileStem(fileName);
  if (!baseAlias) {
    return suffix;
  }
  if (baseAlias.endsWith(suffix)) {
    return baseAlias;
  }
  return `${baseAlias}${suffix}`;
}

/**
 * Serializes `OtoEntry[]` back to clean UTF-8 `oto.ini` text, optionally appending `aliasSuffix`
 * (e.g. `_G4`) without duplicating an already-present suffix, and generating a sensible default
 * alias from `fileStem` when the original alias is blank.
 */
export function serializeOtoIni(
  entries: readonly OtoEntry[],
  aliasSuffix?: string
): string {
  if (entries.length === 0) {
    return '';
  }

  const suffix = aliasSuffix?.trim() ?? '';
  const lines = entries.map((entry) => {
    const finalAlias = applyAliasSuffix(entry.alias, entry.fileName, suffix);
    return `${entry.fileName}=${finalAlias},${entry.offsetMs},${entry.consonantMs},${entry.cutoffMs},${entry.preutteranceMs},${entry.overlapMs}`;
  });

  return `${lines.join('\n')}\n`;
}

/**
 * Maps `OtoEntry` aliases onto matching `ReclistEntry.syllables` (matched case-insensitively by `.wav` basename).
 */
export function attachOtoSyllables(
  entries: readonly ReclistEntry[],
  otoEntries: readonly OtoEntry[]
): ReclistEntry[] {
  if (otoEntries.length === 0) {
    return entries.map((entry) => ({
      ...entry,
      syllables: [...entry.syllables]
    }));
  }

  const syllablesByLowerFile = new Map<string, string[]>();
  for (const oto of otoEntries) {
    const baseKey = extractBaseFileName(oto.fileName).toLowerCase();
    const syllable = oto.alias.trim() || extractFileStem(oto.fileName);
    if (!syllable) {
      continue;
    }
    let list = syllablesByLowerFile.get(baseKey);
    if (!list) {
      list = [];
      syllablesByLowerFile.set(baseKey, list);
    }
    if (!list.includes(syllable)) {
      list.push(syllable);
    }
  }

  return entries.map((entry) => {
    const matched = syllablesByLowerFile.get(entry.fileName.toLowerCase());
    return {
      ...entry,
      syllables: matched ? [...matched] : [...entry.syllables]
    };
  });
}
