import type {
  GuideAudioMode,
  RecordingSetConfig,
  ReclistManifest,
  ScaleNote,
  SupportedEncoding
} from '@shared/types';

export const SUPPORTED_ENCODINGS: readonly SupportedEncoding[] = [
  'auto',
  'utf-8',
  'utf-16le',
  'utf-16be',
  'shift_jis',
  'gb18030'
] as const;

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
// eslint-disable-next-line no-control-regex
const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * Cross-platform safe folder name: strips path separators & Windows-invalid
 * characters, collapses whitespace to `_`, trims trailing dots/spaces, and
 * guards Windows reserved device names. Unicode (e.g. `連続音`, `强`) is kept.
 */
export function sanitizeFolderName(raw: string): string {
  let name = raw.normalize('NFC').replace(INVALID_CHARS, '').trim();
  name = name.replace(/\s+/g, '_');
  name = name.replace(/^\.+/, '').replace(/[. ]+$/, '');
  if (name === '.' || name === '..') {
    name = '';
  }
  if (WINDOWS_RESERVED.test(name)) {
    name = `${name}_`;
  }
  return name.slice(0, 64);
}

export function suggestAliasSuffix(scale: ScaleNote): string {
  return `_${scale}`;
}

export type GuideKind = GuideAudioMode['kind'];

export interface SetDraft {
  id?: string;
  name: string;
  targetLocation: 'root' | 'subfolder';
  subfolderName: string;
  scale: ScaleNote;
  aliasSuffix: string;
  /** True once the user typed a custom suffix (stop auto-following the scale). */
  aliasSuffixTouched: boolean;
  /** True once the user typed a custom folder name (stop auto-following the set name). */
  subfolderTouched: boolean;
  reclistKind: 'builtin' | 'custom';
  builtinId: string;
  reclistPath: string;
  commentFilePath: string;
  otoFilePath: string;
  encoding: SupportedEncoding;
  guideKind: GuideKind;
  bpm: number;
  leadInBeats: number;
  moraCount: number;
  guideFilePath: string;
  generateCompanionFiles: boolean;
  lastCursorIndex: number;
  createdAt?: string;
}

export function defaultDraft(builtins: ReclistManifest[], scale: ScaleNote = 'G4'): SetDraft {
  const first = builtins[0];
  return {
    name: '',
    targetLocation: 'subfolder',
    subfolderName: '',
    scale,
    aliasSuffix: suggestAliasSuffix(scale),
    aliasSuffixTouched: false,
    subfolderTouched: false,
    reclistKind: 'builtin',
    builtinId: first?.id ?? '',
    reclistPath: '',
    commentFilePath: '',
    otoFilePath: '',
    encoding: 'auto',
    guideKind: 'none',
    bpm: first?.recommendedBpm ?? 120,
    leadInBeats: 4,
    moraCount: 8,
    guideFilePath: '',
    generateCompanionFiles: true,
    lastCursorIndex: 0
  };
}

export function draftFromConfig(config: RecordingSetConfig, builtins: ReclistManifest[]): SetDraft {
  const base = defaultDraft(builtins, config.scale);
  const draft: SetDraft = {
    ...base,
    id: config.id,
    name: config.name,
    targetLocation: config.targetLocation,
    subfolderName: config.subfolderName,
    scale: config.scale,
    aliasSuffix: config.aliasSuffix,
    aliasSuffixTouched: true,
    subfolderTouched: true,
    generateCompanionFiles: config.generateCompanionFiles,
    lastCursorIndex: config.lastCursorIndex,
    createdAt: config.createdAt
  };
  if (config.reclistSource.kind === 'builtin') {
    draft.reclistKind = 'builtin';
    draft.builtinId = config.reclistSource.builtinId;
  } else {
    draft.reclistKind = 'custom';
    draft.reclistPath = config.reclistSource.reclistPath;
    draft.commentFilePath = config.reclistSource.commentFilePath ?? '';
    draft.otoFilePath = config.reclistSource.otoFilePath ?? '';
    draft.encoding = config.reclistSource.encoding;
  }
  const guide = config.guideAudio;
  draft.guideKind = guide.kind;
  if (guide.kind === 'pitched-metronome') {
    draft.bpm = guide.bpm;
    draft.leadInBeats = guide.leadInBeats;
    draft.moraCount = guide.moraCount;
  } else if (guide.kind === 'custom-file') {
    draft.guideFilePath = guide.audioFilePath;
  }
  return draft;
}

export type DraftErrorKey =
  | 'nameRequired'
  | 'subfolderRequired'
  | 'subfolderCollision'
  | 'rootCollision'
  | 'reclistRequired'
  | 'guideFileRequired';

export type DraftErrors = Partial<
  Record<'name' | 'subfolder' | 'reclist' | 'guideFile', DraftErrorKey>
>;

/** The folder name that will actually be written (sanitized). */
export function effectiveSubfolder(draft: SetDraft): string {
  return sanitizeFolderName(draft.subfolderName || draft.name);
}

export function validateDraft(draft: SetDraft, existing: RecordingSetConfig[]): DraftErrors {
  const errors: DraftErrors = {};
  const others = existing.filter((set) => set.id !== draft.id);
  if (!draft.name.trim()) {
    errors.name = 'nameRequired';
  }
  if (draft.targetLocation === 'subfolder') {
    const folder = effectiveSubfolder(draft);
    if (!folder) {
      errors.subfolder = 'subfolderRequired';
    } else if (
      others.some(
        (set) =>
          set.targetLocation === 'subfolder' &&
          set.subfolderName.toLowerCase() === folder.toLowerCase()
      )
    ) {
      errors.subfolder = 'subfolderCollision';
    }
  } else if (others.some((set) => set.targetLocation === 'root')) {
    errors.subfolder = 'rootCollision';
  }
  if (draft.reclistKind === 'custom' && !draft.reclistPath) {
    errors.reclist = 'reclistRequired';
  }
  if (draft.reclistKind === 'builtin' && !draft.builtinId) {
    errors.reclist = 'reclistRequired';
  }
  if (draft.guideKind === 'custom-file' && !draft.guideFilePath) {
    errors.guideFile = 'guideFileRequired';
  }
  return errors;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function makeSetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function configFromDraft(draft: SetDraft, now: string = new Date().toISOString()): RecordingSetConfig {
  const guideAudio: GuideAudioMode =
    draft.guideKind === 'pitched-metronome'
      ? {
          kind: 'pitched-metronome',
          bpm: clampInt(draft.bpm, 30, 300, 120),
          leadInBeats: clampInt(draft.leadInBeats, 0, 16, 4),
          moraCount: clampInt(draft.moraCount, 1, 32, 8)
        }
      : draft.guideKind === 'custom-file'
        ? { kind: 'custom-file', audioFilePath: draft.guideFilePath }
        : { kind: 'none' };
  return {
    id: draft.id ?? makeSetId(),
    name: draft.name.trim(),
    targetLocation: draft.targetLocation,
    subfolderName: draft.targetLocation === 'subfolder' ? effectiveSubfolder(draft) : '',
    scale: draft.scale,
    aliasSuffix: draft.aliasSuffix.trim(),
    reclistSource:
      draft.reclistKind === 'builtin'
        ? { kind: 'builtin', builtinId: draft.builtinId }
        : {
            kind: 'custom',
            reclistPath: draft.reclistPath,
            commentFilePath: draft.commentFilePath || undefined,
            otoFilePath: draft.otoFilePath || undefined,
            encoding: draft.encoding
          },
    guideAudio,
    generateCompanionFiles: draft.generateCompanionFiles,
    lastCursorIndex: draft.lastCursorIndex,
    createdAt: draft.createdAt ?? now,
    updatedAt: now
  };
}

export function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] ?? filePath;
}
