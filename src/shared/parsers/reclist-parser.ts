import type { OtoEntry, ReclistEntry } from '@shared/types';
import { normalizeLineEndings } from './encoding';
import { lookupOremoComment } from './oremo-comment';
import { attachOtoSyllables } from './oto-parser';

const FORBIDDEN_FILENAME_CHARS_RE = /[\x00-\x1f\x80-\x9f<>:"/\\|?*]/g;
const WINDOWS_RESERVED_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const MAX_UTF8_STEM_BYTES = 200;

function truncateUtf8Bytes(input: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(input).byteLength <= maxBytes) {
    return input;
  }
  let out = '';
  let used = 0;
  for (const ch of input) {
    const chBytes = encoder.encode(ch).byteLength;
    if (used + chBytes > maxBytes) {
      break;
    }
    out += ch;
    used += chBytes;
  }
  return out;
}

/**
 * Sanitizes a raw reclist line or folder name into a safe cross-platform filename stem
 * across Windows, macOS, and Linux (without `.wav` extension).
 */
export function sanitizeFileStem(raw: string): string {
  let cleaned = raw
    .trim()
    .replace(/\.wav$/i, '')
    .replace(FORBIDDEN_FILENAME_CHARS_RE, '')
    .replace(/[. ]+$/g, '')
    .trim();

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return '';
  }

  if (WINDOWS_RESERVED_NAME_RE.test(cleaned)) {
    cleaned = `_${cleaned}`;
  }

  return truncateUtf8Bytes(cleaned, MAX_UTF8_STEM_BYTES);
}

export interface ParseReclistOptions {
  commentMap?: ReadonlyMap<string, string>;
  otoEntries?: readonly OtoEntry[];
  fallbackHintFn?: (entry: {
    rawPrompt: string;
    fileStem: string;
  }) => string | undefined;
}

function appendComment(existing: string | undefined, next: string): string {
  if (!next) {
    return existing ?? '';
  }
  return existing ? `${existing} / ${next}` : next;
}

/**
 * Parses an OREMO / DeepVocal recording list into `ReclistEntry[]`:
 * - Honors optional standalone `start` header (ignoring lines prior to `start`).
 * - Stops at standalone `end` sentinel.
 * - Attaches `@...` inline comment lines to the preceding or upcoming entry (`inlineComment`).
 * - Sanitizes filenames across Windows/macOS/Linux and resolves duplicate stems case-insensitively
 *   (`foo.wav`, `FOO_1.wav`, `foo_2.wav`).
 */
export function parseReclist(
  text: string,
  options: ParseReclistOptions = {}
): ReclistEntry[] {
  const normalized = normalizeLineEndings(text.replace(/^\uFEFF/, ''));
  const rawLines = normalized.split('\n').map((line) => line.trim());

  // Locate standalone `end` sentinel first, then standalone `start` header prior to `end`
  let endLineIndex = rawLines.length;
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i]!.toLowerCase() === 'end') {
      endLineIndex = i;
      break;
    }
  }

  let startLineIndex = 0;
  for (let i = 0; i < endLineIndex; i++) {
    if (rawLines[i]!.toLowerCase() === 'start') {
      startLineIndex = i + 1;
      break;
    }
  }

  const activeLines = rawLines.slice(startLineIndex, endLineIndex);

  // Detect whether the file leads with `@comment` before the first prompt (prefix comment convention)
  const firstNonEmpty = activeLines.find(
    (line) => line.length > 0 && line.toLowerCase() !== 'start'
  );
  const defaultPrefixComments = Boolean(firstNonEmpty?.startsWith('@'));

  interface DraftEntry {
    rawPrompt: string;
    sanitizedBaseStem: string;
    inlineComment?: string;
  }

  const drafts: DraftEntry[] = [];
  let pendingPrefixComment: string | undefined;
  let sawBlankSinceLastEntry = true;

  for (let i = 0; i < activeLines.length; i++) {
    const line = activeLines[i]!;
    if (!line) {
      sawBlankSinceLastEntry = true;
      continue;
    }

    const lower = line.toLowerCase();
    if (lower === 'start') {
      continue;
    }

    if (line.startsWith('@')) {
      const commentBody = line.slice(1).trim();
      if (!commentBody) {
        continue;
      }

      // Look ahead to see if any prompt entry exists after this `@` line
      let hasFuturePrompt = false;
      for (let j = i + 1; j < activeLines.length; j++) {
        const future = activeLines[j]!;
        if (
          future &&
          future.toLowerCase() !== 'start' &&
          !future.startsWith('@') &&
          sanitizeFileStem(future).length > 0
        ) {
          hasFuturePrompt = true;
          break;
        }
      }

      const attachAsPrefix =
        drafts.length === 0 ||
        (hasFuturePrompt && (defaultPrefixComments || sawBlankSinceLastEntry));

      if (attachAsPrefix && hasFuturePrompt) {
        pendingPrefixComment = appendComment(pendingPrefixComment, commentBody);
      } else if (drafts.length > 0) {
        const prev = drafts[drafts.length - 1]!;
        prev.inlineComment = appendComment(prev.inlineComment, commentBody);
      } else {
        pendingPrefixComment = appendComment(pendingPrefixComment, commentBody);
      }
      continue;
    }

    const sanitizedBaseStem = sanitizeFileStem(line);
    if (!sanitizedBaseStem) {
      continue;
    }

    drafts.push({
      rawPrompt: line,
      sanitizedBaseStem,
      inlineComment: pendingPrefixComment
    });
    pendingPrefixComment = undefined;
    sawBlankSinceLastEntry = false;
  }

  // Resolve duplicate filenames case-insensitively (`foo.wav`, `FOO_1.wav`, `foo_2.wav`)
  const baseCounts = new Map<string, number>();
  const usedStemsLower = new Set<string>();

  const entries: ReclistEntry[] = drafts.map((draft, index) => {
    const baseLower = draft.sanitizedBaseStem.toLowerCase();
    let finalStem: string;

    if (!usedStemsLower.has(baseLower)) {
      finalStem = draft.sanitizedBaseStem;
      baseCounts.set(baseLower, (baseCounts.get(baseLower) ?? 0) + 1);
      usedStemsLower.add(baseLower);
    } else {
      let suffixNum = baseCounts.get(baseLower) ?? 1;
      let candidate = `${draft.sanitizedBaseStem}_${suffixNum}`;
      while (usedStemsLower.has(candidate.toLowerCase())) {
        suffixNum++;
        candidate = `${draft.sanitizedBaseStem}_${suffixNum}`;
      }
      finalStem = candidate;
      baseCounts.set(baseLower, suffixNum + 1);
      usedStemsLower.add(finalStem.toLowerCase());
    }

    const fileName = `${finalStem}.wav`;
    const baseEntry = {
      rawPrompt: draft.rawPrompt,
      fileStem: finalStem,
      fileName
    };

    const hintFromMap = options.commentMap
      ? lookupOremoComment(options.commentMap, baseEntry)
      : undefined;
    const pronunciationHint =
      hintFromMap ??
      options.fallbackHintFn?.({
        rawPrompt: draft.rawPrompt,
        fileStem: finalStem
      });

    const entry: ReclistEntry = {
      index,
      rawPrompt: draft.rawPrompt,
      fileStem: finalStem,
      fileName,
      syllables: []
    };
    if (draft.inlineComment) {
      entry.inlineComment = draft.inlineComment;
    }
    if (pronunciationHint) {
      entry.pronunciationHint = pronunciationHint;
    }
    return entry;
  });

  if (options.otoEntries && options.otoEntries.length > 0) {
    return attachOtoSyllables(entries, options.otoEntries);
  }

  return entries;
}
