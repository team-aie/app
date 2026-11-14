import crypto from 'node:crypto';
import type fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ALL_SCALE_NOTES } from '@shared/music/chromatic';
import {
  decodeTextBuffer,
  normalizeLineEndings,
  parseOtoIni,
  sanitizeFileStem
} from '@shared/parsers';
import {
  type AieProjectManifest,
  DEFAULT_SINGER_FILES,
  type GuideAudioMode,
  type LegacyAieV0Config,
  type ReclistSource,
  type RecordingSetConfig,
  type ScaleNote,
  type SetProgressSummary,
  type SingerFileSelection
} from '@shared/types';
import {
  listBuiltinReclists,
  loadRecordingList,
  normalizeBuiltinReclistId,
  syncSingerScaffolding
} from '../voicebank';

export const PROJECT_MANIFEST_FILENAME = 'aie.project.json';
export const LEGACY_V0_CONFIG_FILENAME = 'aie.config.json';

const VALID_SCALE_NOTES = new Set<string>(ALL_SCALE_NOTES);
const SCALE_NOTE_EXTRACT_RE = /(?:^|[^A-Za-z])(C#|D#|F#|G#|A#|C|D|E|F|G|A|B)([2-5])(?![0-9])/i;

interface ExtendedLegacyV0Set {
  name?: string;
  scale?:
    | string
    | {
        key?: string;
        octave?: number;
      };
  recordingList?: {
    type?: 'built-in' | 'file' | 'custom-file';
    value?: string;
    name?: string;
    filePath?: string;
  };
}

interface ExtendedLegacyV0Config extends Omit<LegacyAieV0Config, 'sets'> {
  sets?: ExtendedLegacyV0Set[];
  recordingSets?: ExtendedLegacyV0Set[];
}

export interface DeleteRecordingSetOptions {
  trashFn?: (targetPath: string) => Promise<void>;
  resourcesRoot?: string;
}

async function pathStat(targetPath: string): Promise<fsSync.Stats | null> {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  const stat = await pathStat(targetPath);
  return Boolean(stat?.isFile());
}

function resolveSetDirectory(
  rootPath: string,
  setConfig: Pick<RecordingSetConfig, 'targetLocation' | 'subfolderName'>
): string {
  if (setConfig.targetLocation === 'subfolder' && setConfig.subfolderName) {
    return path.join(rootPath, setConfig.subfolderName);
  }
  return rootPath;
}

export function extractScaleNote(input: string | undefined): ScaleNote | null {
  if (!input) {
    return null;
  }
  const trimmed = input.trim();
  const directCandidate =
    trimmed.length >= 2
      ? `${trimmed.slice(0, -1).toUpperCase()}${trimmed.slice(-1)}`
      : '';
  if (VALID_SCALE_NOTES.has(directCandidate)) {
    return directCandidate as ScaleNote;
  }

  const match = SCALE_NOTE_EXTRACT_RE.exec(trimmed);
  if (match) {
    const candidate = `${match[1]!.toUpperCase()}${match[2]!}`;
    if (VALID_SCALE_NOTES.has(candidate)) {
      return candidate as ScaleNote;
    }
  }
  return null;
}

function parseLegacyScale(
  rawScale: ExtendedLegacyV0Set['scale'],
  fallbackName?: string
): ScaleNote {
  if (typeof rawScale === 'string') {
    return (
      extractScaleNote(rawScale) ?? extractScaleNote(fallbackName) ?? 'C4'
    );
  }
  if (rawScale && typeof rawScale === 'object') {
    const combined = `${rawScale.key ?? ''}${rawScale.octave ?? ''}`;
    return (
      extractScaleNote(combined) ?? extractScaleNote(fallbackName) ?? 'C4'
    );
  }
  return extractScaleNote(fallbackName) ?? 'C4';
}

async function readCharacterTxtMetadata(
  rootPath: string
): Promise<{ name?: string; author?: string }> {
  const charPath = path.join(rootPath, 'character.txt');
  if (!(await fileExists(charPath))) {
    return {};
  }
  const buf = await fs.readFile(charPath);
  const { text } = decodeTextBuffer(buf, 'auto');
  let name: string | undefined;
  let author: string | undefined;

  for (const rawLine of normalizeLineEndings(text).split('\n')) {
    const trimmed = rawLine.trim();
    const eqOrColon = /^([a-zA-Z]+)\s*[=:]\s*(.+)$/.exec(trimmed);
    if (!eqOrColon) {
      continue;
    }
    const key = eqOrColon[1]!.toLowerCase();
    const val = eqOrColon[2]!.trim();
    if (key === 'name' && val) {
      name = val;
    } else if (key === 'author' && val) {
      author = val;
    }
  }

  return { name, author };
}

async function readPrefixMapHints(
  rootPath: string
): Promise<Map<string, ScaleNote>> {
  const suffixToScale = new Map<string, ScaleNote>();
  const prefixMapPath = path.join(rootPath, 'prefix.map');
  if (!(await fileExists(prefixMapPath))) {
    return suffixToScale;
  }

  const buf = await fs.readFile(prefixMapPath);
  const { text } = decodeTextBuffer(buf, 'auto');
  const notesByToken = new Map<string, ScaleNote[]>();

  for (const rawLine of normalizeLineEndings(text).split('\n')) {
    const parts = rawLine.split('\t');
    if (parts.length < 3) {
      continue;
    }
    const note = extractScaleNote(parts[0]);
    const prefix = parts[1]!.trim();
    const suffix = parts[2]!.trim();
    const token = suffix || prefix.replace(/[\\/]+$/, '');
    if (!note || !token) {
      continue;
    }
    let bucket = notesByToken.get(token);
    if (!bucket) {
      bucket = [];
      notesByToken.set(token, bucket);
    }
    bucket.push(note);
  }

  for (const [token, notes] of notesByToken) {
    if (notes.length > 0) {
      const midNote = notes[Math.floor(notes.length / 2)]!;
      suffixToScale.set(token, midNote);
    }
  }

  return suffixToScale;
}

async function writeProjectManifestJson(
  manifest: AieProjectManifest
): Promise<void> {
  const manifestPath = path.join(manifest.rootPath, PROJECT_MANIFEST_FILENAME);
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}

function resolveSingerFiles(
  singerFiles?: Partial<SingerFileSelection>
): SingerFileSelection {
  return {
    characterTxt:
      typeof singerFiles?.characterTxt === 'boolean'
        ? singerFiles.characterTxt
        : DEFAULT_SINGER_FILES.characterTxt,
    characterYaml:
      typeof singerFiles?.characterYaml === 'boolean'
        ? singerFiles.characterYaml
        : DEFAULT_SINGER_FILES.characterYaml,
    prefixMap:
      typeof singerFiles?.prefixMap === 'boolean'
        ? singerFiles.prefixMap
        : DEFAULT_SINGER_FILES.prefixMap
  };
}

function normalizeActiveSetId(
  manifest: AieProjectManifest
): AieProjectManifest {
  const next: AieProjectManifest = { ...manifest };
  if (next.sets.length === 0) {
    delete next.activeSetId;
    return next;
  }
  const hasValidActive = Boolean(
    next.activeSetId && next.sets.some((s) => s.id === next.activeSetId)
  );
  if (!hasValidActive) {
    next.activeSetId = next.sets[0]!.id;
  }
  return next;
}

async function migrateLegacyV0Config(
  resolvedRoot: string,
  configPath: string,
  resourcesRoot?: string
): Promise<AieProjectManifest> {
  const buf = await fs.readFile(configPath);
  const { text } = decodeTextBuffer(buf, 'auto');
  const parsed = JSON.parse(text) as ExtendedLegacyV0Config;
  const charMeta = await readCharacterTxtMetadata(resolvedRoot);
  const builtinManifests = await listBuiltinReclists(resourcesRoot);
  const builtinById = new Map(builtinManifests.map((m) => [m.id, m] as const));

  const now = new Date().toISOString();
  const rawSets = parsed.sets ?? parsed.recordingSets ?? [];
  const usedSubfoldersLower = new Set<string>();

  const migratedSets: RecordingSetConfig[] = rawSets.map((legacySet, idx) => {
    const rawSetName = legacySet.name?.trim() ?? '';
    const scale = parseLegacyScale(legacySet.scale, rawSetName);
    const displayName = rawSetName || scale || `Set ${idx + 1}`;

    let targetLocation: 'root' | 'subfolder' = 'subfolder';
    let subfolderName = '';

    if (!rawSetName) {
      targetLocation = 'root';
    } else {
      const baseFolder = sanitizeFileStem(rawSetName) || scale;
      let candidate = baseFolder;
      let counter = 1;
      while (usedSubfoldersLower.has(candidate.toLowerCase())) {
        candidate = `${baseFolder}_${counter++}`;
      }
      usedSubfoldersLower.add(candidate.toLowerCase());
      subfolderName = candidate;
    }

    const rl = legacySet.recordingList;
    let reclistSource: ReclistSource;
    let guideAudio: GuideAudioMode = { kind: 'none' };

    if (!rl || rl.type === 'built-in' || (!rl.type && (rl.value || rl.name))) {
      const rawBuiltin = rl?.value ?? rl?.name ?? 'dv_jpn_list_by_alex';
      const builtinId = normalizeBuiltinReclistId(rawBuiltin);
      reclistSource = { kind: 'builtin', builtinId };

      const bm = builtinById.get(builtinId);
      if (bm?.recommendedBpm) {
        guideAudio = {
          kind: 'pitched-metronome',
          bpm: bm.recommendedBpm,
          leadInBeats: 2,
          moraCount: 8
        };
      }
    } else {
      const customPath = rl.value ?? rl.filePath ?? 'reclist.txt';
      reclistSource = {
        kind: 'custom',
        reclistPath: customPath,
        encoding: 'auto'
      };
    }

    const aliasSuffix = targetLocation === 'subfolder' ? `_${scale}` : '';

    return {
      id: crypto.randomUUID(),
      name: displayName,
      targetLocation,
      subfolderName,
      scale,
      aliasSuffix,
      reclistSource,
      guideAudio,
      generateCompanionFiles: true,
      lastCursorIndex: 0,
      createdAt: now,
      updatedAt: now
    };
  });

  let defaultPhonemizer: string | undefined;
  for (const set of migratedSets) {
    if (set.reclistSource.kind === 'builtin') {
      const bm = builtinById.get(set.reclistSource.builtinId);
      if (bm?.defaultPhonemizer) {
        defaultPhonemizer = bm.defaultPhonemizer;
        break;
      }
    }
  }

  const manifest: AieProjectManifest = normalizeActiveSetId({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name:
      parsed.name?.trim() ||
      charMeta.name ||
      path.basename(resolvedRoot) ||
      'Migrated Singer',
    rootPath: resolvedRoot,
    ...(charMeta.author ? { author: charMeta.author } : {}),
    ...(defaultPhonemizer ? { defaultPhonemizer } : {}),
    singerFiles: { ...DEFAULT_SINGER_FILES },
    sets: migratedSets,
    createdAt: now,
    updatedAt: now
  });

  await writeProjectManifestJson(manifest);
  await syncSingerScaffolding(manifest, resourcesRoot);
  return manifest;
}

function findCandidateReclistTxt(fileNames: readonly string[]): string | undefined {
  const excludedLower = new Set([
    'character.txt',
    'oremo-comment.txt',
    'readme.txt'
  ]);
  const txtFiles = fileNames.filter(
    (name) =>
      name.toLowerCase().endsWith('.txt') &&
      !excludedLower.has(name.toLowerCase())
  );
  const explicitReclist = txtFiles.find((name) =>
    name.toLowerCase().includes('reclist')
  );
  return explicitReclist ?? txtFiles[0];
}

function detectCommonAliasSuffix(
  aliases: readonly string[],
  candidates: readonly string[]
): string {
  const nonEmpty = aliases.map((a) => a.trim()).filter((a) => a.length > 0);
  if (nonEmpty.length === 0) {
    return '';
  }
  for (const candidate of candidates) {
    if (
      candidate &&
      nonEmpty.every((alias) => alias.endsWith(candidate))
    ) {
      return candidate;
    }
  }
  return '';
}

async function buildAdoptedSetFromDirectory(params: {
  rootPath: string;
  dirPath: string;
  targetLocation: 'root' | 'subfolder';
  subfolderName: string;
  prefixMapHints: ReadonlyMap<string, ScaleNote>;
  now: string;
}): Promise<RecordingSetConfig | null> {
  const {
    rootPath,
    dirPath,
    targetLocation,
    subfolderName,
    prefixMapHints,
    now
  } = params;

  let dirents: fsSync.Dirent[];
  try {
    dirents = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const fileNames = dirents
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  const wavFiles = fileNames
    .filter((name) => name.toLowerCase().endsWith('.wav'))
    .sort((a, b) => a.localeCompare(b));

  const otoFileName = fileNames.find(
    (name) => name.toLowerCase() === 'oto.ini'
  );
  const commentFileName = fileNames.find(
    (name) => name.toLowerCase() === 'oremo-comment.txt'
  );
  const reclistFileName = findCandidateReclistTxt(fileNames);

  if (wavFiles.length === 0 && !otoFileName && !reclistFileName) {
    return null;
  }

  let otoAliases: string[] = [];
  const orderedStems: string[] = [];
  const seenStemsLower = new Set<string>();

  if (otoFileName) {
    const otoBuf = await fs.readFile(path.join(dirPath, otoFileName));
    const { text: otoText } = decodeTextBuffer(otoBuf, 'auto');
    const otoEntries = parseOtoIni(otoText);
    otoAliases = otoEntries.map((e) => e.alias);

    for (const entry of otoEntries) {
      const baseWav = path.posix.basename(entry.fileName.replace(/\\/g, '/'));
      const stem = baseWav.replace(/\.wav$/i, '');
      const lower = stem.toLowerCase();
      if (stem && !seenStemsLower.has(lower)) {
        seenStemsLower.add(lower);
        orderedStems.push(stem);
      }
    }
  }

  for (const wavName of wavFiles) {
    const stem = wavName.replace(/\.wav$/i, '');
    const lower = stem.toLowerCase();
    if (stem && !seenStemsLower.has(lower)) {
      seenStemsLower.add(lower);
      orderedStems.push(stem);
    }
  }

  let relativeReclistPath: string;
  if (reclistFileName) {
    relativeReclistPath =
      targetLocation === 'subfolder'
        ? path.join(subfolderName, reclistFileName)
        : reclistFileName;
  } else {
    const generatedReclistName = 'reclist.txt';
    const generatedFullPath = path.join(dirPath, generatedReclistName);
    await fs.writeFile(
      generatedFullPath,
      `${orderedStems.join('\n')}\n`,
      'utf8'
    );
    relativeReclistPath =
      targetLocation === 'subfolder'
        ? path.join(subfolderName, generatedReclistName)
        : generatedReclistName;
  }

  const folderLabel =
    targetLocation === 'subfolder' ? subfolderName : path.basename(rootPath);
  const inferredScale =
    extractScaleNote(subfolderName) ??
    prefixMapHints.get(`_${subfolderName}`) ??
    prefixMapHints.get(subfolderName) ??
    extractScaleNote(folderLabel) ??
    'C4';

  const detectedOtoSuffix = detectCommonAliasSuffix(otoAliases, [
    `_${subfolderName}`,
    `_${inferredScale}`
  ]);

  const aliasSuffix =
    detectedOtoSuffix ||
    (targetLocation === 'subfolder' && !otoFileName ? `_${inferredScale}` : '');

  const reclistSource: ReclistSource = {
    kind: 'custom',
    reclistPath: relativeReclistPath,
    ...(commentFileName
      ? {
          commentFilePath:
            targetLocation === 'subfolder'
              ? path.join(subfolderName, commentFileName)
              : commentFileName
        }
      : {}),
    ...(otoFileName
      ? {
          otoFilePath:
            targetLocation === 'subfolder'
              ? path.join(subfolderName, otoFileName)
              : otoFileName
        }
      : {}),
    encoding: reclistFileName ? 'auto' : 'utf-8'
  };

  return {
    id: crypto.randomUUID(),
    name: targetLocation === 'subfolder' ? subfolderName : 'Main',
    targetLocation,
    subfolderName,
    scale: inferredScale,
    aliasSuffix,
    reclistSource,
    guideAudio: { kind: 'none' },
    generateCompanionFiles: true,
    lastCursorIndex: 0,
    createdAt: now,
    updatedAt: now
  };
}

async function adoptRawOremoFolder(
  resolvedRoot: string,
  resourcesRoot?: string
): Promise<AieProjectManifest> {
  const now = new Date().toISOString();
  const charMeta = await readCharacterTxtMetadata(resolvedRoot);
  const prefixMapHints = await readPrefixMapHints(resolvedRoot);

  const rootDirents = await fs.readdir(resolvedRoot, { withFileTypes: true });
  const subdirs = rootDirents
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const adoptedSets: RecordingSetConfig[] = [];

  // Check root-level voicebank files first (if root `.wav`s exist, or if no subfolders exist)
  const rootFiles = rootDirents
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const hasRootWavs = rootFiles.some((name) =>
    name.toLowerCase().endsWith('.wav')
  );

  if (hasRootWavs) {
    const rootSet = await buildAdoptedSetFromDirectory({
      rootPath: resolvedRoot,
      dirPath: resolvedRoot,
      targetLocation: 'root',
      subfolderName: '',
      prefixMapHints,
      now
    });
    if (rootSet) {
      adoptedSets.push(rootSet);
    }
  }

  for (const subdir of subdirs) {
    const subSet = await buildAdoptedSetFromDirectory({
      rootPath: resolvedRoot,
      dirPath: path.join(resolvedRoot, subdir),
      targetLocation: 'subfolder',
      subfolderName: subdir,
      prefixMapHints,
      now
    });
    if (subSet) {
      adoptedSets.push(subSet);
    }
  }

  if (adoptedSets.length === 0) {
    const rootFallbackSet = await buildAdoptedSetFromDirectory({
      rootPath: resolvedRoot,
      dirPath: resolvedRoot,
      targetLocation: 'root',
      subfolderName: '',
      prefixMapHints,
      now
    });
    if (rootFallbackSet) {
      adoptedSets.push(rootFallbackSet);
    }
  }

  const manifest: AieProjectManifest = normalizeActiveSetId({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: charMeta.name || path.basename(resolvedRoot) || 'Imported Singer',
    rootPath: resolvedRoot,
    ...(charMeta.author ? { author: charMeta.author } : {}),
    singerFiles: { ...DEFAULT_SINGER_FILES },
    sets: adoptedSets,
    createdAt: now,
    updatedAt: now
  });

  await writeProjectManifestJson(manifest);
  await syncSingerScaffolding(manifest, resourcesRoot);
  return manifest;
}

export async function createProject(
  params: {
    name: string;
    rootPath: string;
    author?: string;
    singerFiles?: SingerFileSelection;
  },
  resourcesRoot?: string
): Promise<AieProjectManifest> {
  const resolvedRoot = path.resolve(params.rootPath);
  await fs.mkdir(resolvedRoot, { recursive: true });

  const now = new Date().toISOString();
  const singerName =
    params.name.trim() || path.basename(resolvedRoot) || 'Untitled Singer';
  const author = params.author?.trim();

  const manifest: AieProjectManifest = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: singerName,
    rootPath: resolvedRoot,
    ...(author ? { author } : {}),
    singerFiles: resolveSingerFiles(params.singerFiles),
    sets: [],
    createdAt: now,
    updatedAt: now
  };

  await writeProjectManifestJson(manifest);
  await syncSingerScaffolding(manifest, resourcesRoot);
  return manifest;
}

export async function openProject(
  rootPath: string,
  resourcesRoot?: string
): Promise<AieProjectManifest> {
  const resolvedRoot = path.resolve(rootPath);
  const rootStat = await pathStat(resolvedRoot);
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`Project directory does not exist: ${resolvedRoot}`);
  }

  // (a) Modern v1 `aie.project.json`
  const v1ManifestPath = path.join(resolvedRoot, PROJECT_MANIFEST_FILENAME);
  if (await fileExists(v1ManifestPath)) {
    const buf = await fs.readFile(v1ManifestPath);
    const { text } = decodeTextBuffer(buf, 'auto');
    const parsed = JSON.parse(text) as AieProjectManifest;
    return normalizeActiveSetId({
      ...parsed,
      schemaVersion: 1,
      rootPath: resolvedRoot,
      singerFiles: resolveSingerFiles(parsed.singerFiles),
      sets: Array.isArray(parsed.sets) ? parsed.sets : []
    });
  }

  // (b) Legacy v0.x `aie.config.json` automatic migration
  const legacyConfigPath = path.join(resolvedRoot, LEGACY_V0_CONFIG_FILENAME);
  if (await fileExists(legacyConfigPath)) {
    return migrateLegacyV0Config(resolvedRoot, legacyConfigPath, resourcesRoot);
  }

  // (c) Raw OREMO / UTAU voicebank folder adoption
  return adoptRawOremoFolder(resolvedRoot, resourcesRoot);
}

export async function saveProject(
  manifest: AieProjectManifest,
  resourcesRoot?: string
): Promise<AieProjectManifest> {
  const resolvedRoot = path.resolve(manifest.rootPath);
  await fs.mkdir(resolvedRoot, { recursive: true });

  const updated: AieProjectManifest = normalizeActiveSetId({
    ...manifest,
    schemaVersion: 1,
    rootPath: resolvedRoot,
    singerFiles: resolveSingerFiles(manifest.singerFiles),
    updatedAt: new Date().toISOString()
  });

  await writeProjectManifestJson(updated);
  await syncSingerScaffolding(updated, resourcesRoot);
  return updated;
}

export async function upsertRecordingSet(
  rootPath: string,
  setConfig: RecordingSetConfig,
  resourcesRoot?: string
): Promise<AieProjectManifest> {
  const current = await openProject(rootPath, resourcesRoot);
  const now = new Date().toISOString();

  let sanitizedSubfolder = '';
  if (setConfig.targetLocation === 'subfolder') {
    sanitizedSubfolder = sanitizeFileStem(setConfig.subfolderName);
    if (!sanitizedSubfolder) {
      throw new Error('Recording set subfolder name cannot be empty.');
    }

    const colliding = current.sets.find(
      (existing) =>
        existing.id !== setConfig.id &&
        existing.targetLocation === 'subfolder' &&
        existing.subfolderName.toLowerCase() ===
          sanitizedSubfolder.toLowerCase()
    );
    if (colliding) {
      throw new Error(
        `Subfolder "${sanitizedSubfolder}" is already used by set "${colliding.name}".`
      );
    }
  }

  const normalizedSet: RecordingSetConfig = {
    ...setConfig,
    name: setConfig.name.trim() || sanitizedSubfolder || setConfig.scale,
    subfolderName:
      setConfig.targetLocation === 'subfolder' ? sanitizedSubfolder : '',
    updatedAt: now
  };

  const existingIdx = current.sets.findIndex((s) => s.id === normalizedSet.id);
  const nextSets = [...current.sets];
  if (existingIdx >= 0) {
    const prev = nextSets[existingIdx]!;
    nextSets[existingIdx] = {
      ...normalizedSet,
      createdAt: prev.createdAt || normalizedSet.createdAt || now
    };
  } else {
    nextSets.push({
      ...normalizedSet,
      createdAt: normalizedSet.createdAt || now
    });
  }

  const updatedManifest: AieProjectManifest = normalizeActiveSetId({
    ...current,
    singerFiles: resolveSingerFiles(current.singerFiles),
    sets: nextSets,
    activeSetId: current.activeSetId ?? normalizedSet.id,
    updatedAt: now
  });

  await writeProjectManifestJson(updatedManifest);
  await syncSingerScaffolding(updatedManifest, resourcesRoot);
  return updatedManifest;
}

async function resolveDefaultTrashFn(): Promise<
  (targetPath: string) => Promise<void>
> {
  const electronMod = await import('electron');
  if (electronMod?.shell?.trashItem) {
    return (targetPath: string) => electronMod.shell.trashItem(targetPath);
  }
  throw new Error(
    'OS Trash function is unavailable outside Electron Main unless trashFn is provided.'
  );
}

export async function deleteRecordingSet(
  params: {
    rootPath: string;
    setId: string;
    trashWavFiles: boolean;
  },
  trashOrOptions?:
    | ((targetPath: string) => Promise<void>)
    | DeleteRecordingSetOptions
): Promise<AieProjectManifest> {
  const opts: DeleteRecordingSetOptions =
    typeof trashOrOptions === 'function'
      ? { trashFn: trashOrOptions }
      : (trashOrOptions ?? {});

  const current = await openProject(params.rootPath, opts.resourcesRoot);
  const targetSet = current.sets.find((s) => s.id === params.setId);

  if (targetSet && params.trashWavFiles) {
    const setDir = resolveSetDirectory(current.rootPath, targetSet);
    const stat = await pathStat(setDir);
    if (stat?.isDirectory()) {
      const dirents = await fs.readdir(setDir, { withFileTypes: true });
      const wavFiles = dirents
        .filter(
          (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.wav')
        )
        .map((entry) => path.join(setDir, entry.name));

      if (wavFiles.length > 0) {
        const trashFn = opts.trashFn ?? (await resolveDefaultTrashFn());
        for (const wavPath of wavFiles) {
          await trashFn(wavPath);
        }
      }
    }
  }

  const remainingSets = current.sets.filter((s) => s.id !== params.setId);
  const nextActiveSetId =
    current.activeSetId === params.setId
      ? remainingSets[0]?.id
      : current.activeSetId;

  const updated: AieProjectManifest = normalizeActiveSetId({
    ...current,
    singerFiles: resolveSingerFiles(current.singerFiles),
    sets: remainingSets,
    ...(nextActiveSetId ? { activeSetId: nextActiveSetId } : {}),
    updatedAt: new Date().toISOString()
  });

  if (!nextActiveSetId) {
    delete updated.activeSetId;
  }

  await writeProjectManifestJson(updated);
  await syncSingerScaffolding(updated, opts.resourcesRoot);
  return updated;
}

export async function getSetProgress(
  rootPath: string,
  setConfig: RecordingSetConfig,
  resourcesRoot?: string
): Promise<SetProgressSummary> {
  const resolvedRoot = path.resolve(rootPath);
  const bundle = await loadRecordingList(
    resolvedRoot,
    setConfig,
    resourcesRoot
  );
  const setDir = resolveSetDirectory(resolvedRoot, setConfig);

  const diskWavsLower = new Set<string>();
  try {
    const dirents = await fs.readdir(setDir, { withFileTypes: true });
    for (const entry of dirents) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.wav')) {
        diskWavsLower.add(entry.name.toLowerCase());
      }
    }
  } catch {
    // Directory does not exist yet -> 0 recorded files
  }

  const recordedFileNames = bundle.entries
    .filter((entry) => diskWavsLower.has(entry.fileName.toLowerCase()))
    .map((entry) => entry.fileName);

  return {
    setId: setConfig.id,
    recordedCount: recordedFileNames.length,
    totalCount: bundle.entries.length,
    recordedFileNames
  };
}
