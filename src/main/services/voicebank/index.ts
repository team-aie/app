import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { scaleNoteToMidi } from '@shared/music/chromatic';
import {
  decodeTextBuffer,
  formatDeltaEngXsampaHint,
  normalizeLineEndings,
  parseOremoComment,
  parseOtoIni,
  parseReclist,
  serializeOtoIni
} from '@shared/parsers';
import {
  type AieProjectManifest,
  type CharacterYamlManifest,
  DEFAULT_SINGER_FILES,
  PITCH_CLASSES,
  type ParsedRecordingListBundle,
  type ReclistManifest,
  type RecordingSetConfig,
  type SubbankSpec,
  type SupportedEncoding
} from '@shared/types';

const LEGACY_BUILTIN_ID_MAP: Readonly<Record<string, string>> = {
  'z.cvvc_normal': 'z_cvvc_normal',
  'z式cvvc-normal (z chinese cvvc - normal)': 'z_cvvc_normal',
  delta_eng_ver5: 'delta_eng_ver5',
  'デルタ式英語リストver5 (delta english ver. 5)': 'delta_eng_ver5',
  dv_jpn_list_by_alex: 'dv_jpn_list_by_alex',
  'dv jpn list by alex': 'dv_jpn_list_by_alex',
  extended_cvvc_8lite: 'extended_cvvc_8lite',
  '扩展cvvc 8lite (extended cvvc 8lite)': 'extended_cvvc_8lite'
};

const MIN_PREFIX_MAP_MIDI = 24; // C1
const MAX_PREFIX_MAP_MIDI = 107; // B7

export function normalizeBuiltinReclistId(rawIdOrName: string): string {
  const trimmed = rawIdOrName.trim();
  const mapped = LEGACY_BUILTIN_ID_MAP[trimmed.toLowerCase()];
  if (mapped) {
    return mapped;
  }
  return trimmed.replace(/\./g, '_');
}

export function resolveReclistsRootSync(resourcesRoot?: string): string {
  if (resourcesRoot) {
    const nested = path.join(resourcesRoot, 'reclists');
    if (
      fsSync.existsSync(nested) &&
      fsSync.statSync(nested).isDirectory()
    ) {
      return nested;
    }
    return path.resolve(resourcesRoot);
  }

  const procWithResources = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  if (procWithResources.resourcesPath) {
    const packagedReclists = path.join(
      procWithResources.resourcesPath,
      'reclists'
    );
    if (
      fsSync.existsSync(packagedReclists) &&
      fsSync.statSync(packagedReclists).isDirectory()
    ) {
      return packagedReclists;
    }
  }

  const cwdReclists = path.resolve(process.cwd(), 'resources', 'reclists');
  if (
    fsSync.existsSync(cwdReclists) &&
    fsSync.statSync(cwdReclists).isDirectory()
  ) {
    return cwdReclists;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, '../../../../resources/reclists'),
    path.resolve(moduleDir, '../../resources/reclists')
  ];
  for (const candidate of candidates) {
    if (
      fsSync.existsSync(candidate) &&
      fsSync.statSync(candidate).isDirectory()
    ) {
      return candidate;
    }
  }

  return cwdReclists;
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch {
    return false;
  }
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

function resolveMaybeRelative(rootPath: string, targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(rootPath, targetPath);
}

function midiToNoteName(midi: number): string {
  const pitchIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_CLASSES[pitchIndex]!}${octave}`;
}

export async function listBuiltinReclists(
  resourcesRoot?: string
): Promise<ReclistManifest[]> {
  const reclistsRoot = resolveReclistsRootSync(resourcesRoot);
  let dirents: fsSync.Dirent[];
  try {
    dirents = await fs.readdir(reclistsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const subdirs = dirents
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const manifests: ReclistManifest[] = [];
  for (const subdir of subdirs) {
    const manifestPath = path.join(reclistsRoot, subdir, 'manifest.json');
    if (!(await fileExists(manifestPath))) {
      continue;
    }
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as ReclistManifest;
    manifests.push(parsed);
  }

  return manifests;
}

async function readOptionalDecodedText(
  candidates: readonly string[],
  encoding: SupportedEncoding = 'auto'
): Promise<{ text: string; path: string } | undefined> {
  for (const candidate of candidates) {
    if (candidate && (await fileExists(candidate))) {
      const buf = await fs.readFile(candidate);
      const decoded = decodeTextBuffer(buf, encoding);
      return { text: decoded.text, path: candidate };
    }
  }
  return undefined;
}

export async function loadRecordingList(
  rootPath: string,
  setConfig: RecordingSetConfig,
  resourcesRoot?: string
): Promise<ParsedRecordingListBundle> {
  const resolvedRoot = path.resolve(rootPath);
  const setDir = resolveSetDirectory(resolvedRoot, setConfig);

  if (setConfig.reclistSource.kind === 'builtin') {
    const reclistsRoot = resolveReclistsRootSync(resourcesRoot);
    const builtinId = normalizeBuiltinReclistId(
      setConfig.reclistSource.builtinId
    );
    const builtinDir = path.join(reclistsRoot, builtinId);
    const manifestPath = path.join(builtinDir, 'manifest.json');

    if (!(await fileExists(manifestPath))) {
      throw new Error(`Unknown built-in recording list: ${builtinId}`);
    }

    const manifest = JSON.parse(
      await fs.readFile(manifestPath, 'utf8')
    ) as ReclistManifest;

    const reclistFilePath = path.join(builtinDir, manifest.reclistFile);
    const reclistBuf = await fs.readFile(reclistFilePath);
    const { text: reclistText, detectedEncoding } = decodeTextBuffer(
      reclistBuf,
      'auto'
    );

    const commentResult = await readOptionalDecodedText([
      path.join(setDir, 'OREMO-comment.txt'),
      path.join(resolvedRoot, 'OREMO-comment.txt'),
      path.join(builtinDir, 'OREMO-comment.txt')
    ]);
    const commentMap = commentResult
      ? parseOremoComment(commentResult.text)
      : undefined;

    const otoCandidates: string[] = [path.join(setDir, 'oto.ini')];
    if (manifest.otoFile) {
      otoCandidates.push(path.join(builtinDir, manifest.otoFile));
    }
    const otoResult = await readOptionalDecodedText(otoCandidates);
    const otoEntries = otoResult ? parseOtoIni(otoResult.text) : [];

    const dvcfgResult = await readOptionalDecodedText([
      path.join(setDir, 'voice.dvcfg'),
      path.join(builtinDir, 'voice.dvcfg'),
      path.join(setDir, 'voice.voiceDvcfg'),
      path.join(builtinDir, 'voice.voiceDvcfg')
    ]);

    const readmeResult = manifest.readmeFile
      ? await readOptionalDecodedText([
          path.join(builtinDir, manifest.readmeFile)
        ])
      : undefined;

    const entries = parseReclist(reclistText, {
      commentMap,
      otoEntries,
      fallbackHintFn:
        builtinId === 'delta_eng_ver5'
          ? ({ rawPrompt }) => formatDeltaEngXsampaHint(rawPrompt)
          : undefined
    });

    const bundle: ParsedRecordingListBundle = {
      entries,
      otoEntries,
      detectedEncoding
    };
    if (otoResult !== undefined) {
      bundle.rawOtoText = otoResult.text;
    }
    if (dvcfgResult !== undefined) {
      bundle.rawDvcfgText = dvcfgResult.text;
    }
    if (readmeResult !== undefined) {
      bundle.readmeMarkdown = readmeResult.text;
    }
    return bundle;
  }

  // Custom reclist source
  const {
    reclistPath,
    commentFilePath,
    otoFilePath,
    encoding
  } = setConfig.reclistSource;
  const resolvedReclistPath = resolveMaybeRelative(resolvedRoot, reclistPath);
  if (!(await fileExists(resolvedReclistPath))) {
    throw new Error(`Custom recording list not found: ${resolvedReclistPath}`);
  }

  const baseFolder = path.dirname(resolvedReclistPath);
  const reclistBuf = await fs.readFile(resolvedReclistPath);
  const { text: reclistText, detectedEncoding } = decodeTextBuffer(
    reclistBuf,
    encoding
  );

  const companionEncoding: SupportedEncoding =
    encoding === 'auto' ? 'auto' : encoding;

  const commentCandidates: string[] = [];
  if (commentFilePath) {
    commentCandidates.push(resolveMaybeRelative(resolvedRoot, commentFilePath));
  }
  commentCandidates.push(
    path.join(setDir, 'OREMO-comment.txt'),
    path.join(baseFolder, 'OREMO-comment.txt')
  );
  const commentResult = await readOptionalDecodedText(
    commentCandidates,
    companionEncoding
  );
  const commentMap = commentResult
    ? parseOremoComment(commentResult.text)
    : undefined;

  const otoCandidates: string[] = [];
  if (otoFilePath) {
    otoCandidates.push(resolveMaybeRelative(resolvedRoot, otoFilePath));
  }
  otoCandidates.push(
    path.join(setDir, 'oto.ini'),
    path.join(baseFolder, 'oto.ini')
  );
  const otoResult = await readOptionalDecodedText(otoCandidates, 'auto');
  const otoEntries = otoResult ? parseOtoIni(otoResult.text) : [];

  const dvcfgResult = await readOptionalDecodedText([
    path.join(setDir, 'voice.dvcfg'),
    path.join(baseFolder, 'voice.dvcfg'),
    path.join(setDir, 'voice.voiceDvcfg'),
    path.join(baseFolder, 'voice.voiceDvcfg')
  ]);

  const readmeResult = await readOptionalDecodedText([
    path.join(baseFolder, 'README.md'),
    path.join(baseFolder, 'readme.md'),
    path.join(baseFolder, 'readme.txt'),
    path.join(baseFolder, 'README.txt')
  ]);

  const entries = parseReclist(reclistText, {
    commentMap,
    otoEntries
  });

  const bundle: ParsedRecordingListBundle = {
    entries,
    otoEntries,
    detectedEncoding
  };
  if (otoResult !== undefined) {
    bundle.rawOtoText = otoResult.text;
  }
  if (dvcfgResult !== undefined) {
    bundle.rawDvcfgText = dvcfgResult.text;
  }
  if (readmeResult !== undefined) {
    bundle.readmeMarkdown = readmeResult.text;
  }
  return bundle;
}

interface PartitionedSubbankEntry {
  set: RecordingSetConfig;
  color: string;
  prefix: string;
  suffix: string;
  lowMidi: number;
  highMidi: number;
  toneRange: string;
}

function partitionSetsIntoSubbanks(
  sets: readonly RecordingSetConfig[]
): PartitionedSubbankEntry[] {
  if (sets.length === 0) {
    return [];
  }

  // Group sets into default voice color ('') for the first set at each scale,
  // and named expression colors for additional sets sharing an already-used scale.
  const colorGroups = new Map<string, RecordingSetConfig[]>();
  const usedPrimaryScales = new Set<string>();

  for (const set of sets) {
    let color = '';
    if (usedPrimaryScales.has(set.scale)) {
      color = set.name.trim() || set.subfolderName.trim() || set.id;
    } else {
      usedPrimaryScales.add(set.scale);
    }
    let group = colorGroups.get(color);
    if (!group) {
      group = [];
      colorGroups.set(color, group);
    }
    group.push(set);
  }

  const results: PartitionedSubbankEntry[] = [];

  for (const [color, groupSets] of colorGroups) {
    const sorted = [...groupSets].sort(
      (a, b) => scaleNoteToMidi(a.scale) - scaleNoteToMidi(b.scale)
    );

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i]!;
      const currentMidi = scaleNoteToMidi(current.scale);
      const prevMidi =
        i > 0 ? scaleNoteToMidi(sorted[i - 1]!.scale) : undefined;
      const nextMidi =
        i + 1 < sorted.length ? scaleNoteToMidi(sorted[i + 1]!.scale) : undefined;

      const lowMidi =
        prevMidi === undefined
          ? MIN_PREFIX_MAP_MIDI
          : Math.floor((prevMidi + currentMidi) / 2) + 1;
      const highMidi =
        nextMidi === undefined
          ? MAX_PREFIX_MAP_MIDI
          : Math.floor((currentMidi + nextMidi) / 2);

      const toneRange = `${midiToNoteName(lowMidi)}-${midiToNoteName(highMidi)}`;
      results.push({
        set: current,
        color,
        prefix: '',
        suffix: current.aliasSuffix,
        lowMidi,
        highMidi,
        toneRange
      });
    }
  }

  return results;
}

export function buildCharacterYamlManifest(
  manifest: AieProjectManifest,
  builtinReclists: readonly ReclistManifest[] = []
): CharacterYamlManifest {
  const builtinById = new Map(
    builtinReclists.map((item) => [item.id, item] as const)
  );

  let defaultPhonemizer = manifest.defaultPhonemizer?.trim() || undefined;
  if (!defaultPhonemizer) {
    for (const set of manifest.sets) {
      if (set.reclistSource.kind === 'builtin') {
        const builtinId = normalizeBuiltinReclistId(
          set.reclistSource.builtinId
        );
        const found = builtinById.get(builtinId);
        if (found?.defaultPhonemizer) {
          defaultPhonemizer = found.defaultPhonemizer;
          break;
        }
      }
    }
  }
  if (!defaultPhonemizer) {
    defaultPhonemizer = 'OpenUtau.Core.DefaultPhonemizer';
  }

  const partitioned = partitionSetsIntoSubbanks(manifest.sets);
  const subbanks: SubbankSpec[] = partitioned.map((item) => ({
    color: item.color,
    prefix: item.prefix,
    suffix: item.suffix,
    toneRanges: [item.toneRange]
  }));

  const doc: CharacterYamlManifest = {
    name: manifest.name,
    singerType: 'utau',
    textFileEncoding: 'utf-8',
    defaultPhonemizer,
    subbanks
  };

  if (manifest.author?.trim()) {
    doc.author = manifest.author.trim();
  }

  return doc;
}

export function serializeCharacterYaml(doc: CharacterYamlManifest): string {
  const rawYamlObject: Record<string, unknown> = {
    name: doc.name,
    singer_type: doc.singerType,
    text_file_encoding: doc.textFileEncoding
  };

  if (doc.author) {
    rawYamlObject.author = doc.author;
  }
  if (doc.voice) {
    rawYamlObject.voice = doc.voice;
  }
  if (doc.defaultPhonemizer) {
    rawYamlObject.default_phonemizer = doc.defaultPhonemizer;
  }

  rawYamlObject.subbanks = doc.subbanks.map((sub) => ({
    color: sub.color,
    prefix: sub.prefix,
    suffix: sub.suffix,
    tone_ranges: sub.toneRanges
  }));

  return stringifyYaml(rawYamlObject);
}

export function buildPrefixMap(sets: readonly RecordingSetConfig[]): string {
  const primaryPartitions = partitionSetsIntoSubbanks(sets).filter(
    (entry) => entry.color === ''
  );

  const lines: string[] = [];
  for (let midi = MAX_PREFIX_MAP_MIDI; midi >= MIN_PREFIX_MAP_MIDI; midi--) {
    const note = midiToNoteName(midi);
    const match = primaryPartitions.find(
      (part) => midi >= part.lowMidi && midi <= part.highMidi
    );
    const prefix = match?.prefix ?? '';
    const suffix = match?.suffix ?? '';
    lines.push(`${note}\t${prefix}\t${suffix}`);
  }
  return `${lines.join('\n')}\n`;
}

async function writeCharacterTxt(
  rootPath: string,
  manifest: AieProjectManifest
): Promise<void> {
  const charTxtPath = path.join(rootPath, 'character.txt');
  const preservedLines: string[] = [];

  if (await fileExists(charTxtPath)) {
    const existingBuf = await fs.readFile(charTxtPath);
    const { text } = decodeTextBuffer(existingBuf, 'auto');
    for (const rawLine of normalizeLineEndings(text).split('\n')) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        continue;
      }
      const lower = trimmed.toLowerCase();
      if (
        lower.startsWith('name=') ||
        lower.startsWith('name:') ||
        lower.startsWith('author=') ||
        lower.startsWith('author:')
      ) {
        continue;
      }
      preservedLines.push(trimmed);
    }
  }

  const outLines = [`name=${manifest.name}`];
  if (manifest.author?.trim()) {
    outLines.push(`author=${manifest.author.trim()}`);
  }
  outLines.push(...preservedLines);

  await fs.writeFile(charTxtPath, `${outLines.join('\n')}\n`, 'utf8');
}

async function copyCompanionFilesForSet(
  rootPath: string,
  setConfig: RecordingSetConfig,
  reclistsRoot: string
): Promise<void> {
  const setDir = resolveSetDirectory(rootPath, setConfig);
  await fs.mkdir(setDir, { recursive: true });

  if (setConfig.reclistSource.kind === 'builtin') {
    const builtinId = normalizeBuiltinReclistId(
      setConfig.reclistSource.builtinId
    );
    const builtinDir = path.join(reclistsRoot, builtinId);
    const manifestPath = path.join(builtinDir, 'manifest.json');
    if (!(await fileExists(manifestPath))) {
      return;
    }

    const builtinManifest = JSON.parse(
      await fs.readFile(manifestPath, 'utf8')
    ) as ReclistManifest;

    const companionSet = new Set<string>(builtinManifest.companionFiles);
    if (builtinManifest.otoFile) {
      companionSet.add(builtinManifest.otoFile);
    }

    for (const companionName of companionSet) {
      const srcPath = path.join(builtinDir, companionName);
      if (!(await fileExists(srcPath))) {
        continue;
      }
      const srcBuf = await fs.readFile(srcPath);
      const { text } = decodeTextBuffer(srcBuf, 'auto');

      if (companionName.toLowerCase() === 'oto.ini') {
        const otoEntries = parseOtoIni(text);
        const serialized = serializeOtoIni(otoEntries, setConfig.aliasSuffix);
        await fs.writeFile(path.join(setDir, 'oto.ini'), serialized, 'utf8');
      } else {
        const cleanUtf8 = text.endsWith('\n') ? text : `${text}\n`;
        await fs.writeFile(path.join(setDir, companionName), cleanUtf8, 'utf8');

        // Also place presamp*.ini at voicebank root so OpenUtau ChineseCVVCPhonemizer discovers it automatically
        if (
          setDir !== rootPath &&
          /^presamp.*\.ini$/i.test(companionName)
        ) {
          await fs.writeFile(
            path.join(rootPath, companionName),
            cleanUtf8,
            'utf8'
          );
        }
      }
    }
    return;
  }

  // Custom reclist source companion copy
  const resolvedReclistPath = resolveMaybeRelative(
    rootPath,
    setConfig.reclistSource.reclistPath
  );
  const baseFolder = path.dirname(resolvedReclistPath);

  const srcOtoCandidates: string[] = [];
  if (setConfig.reclistSource.otoFilePath) {
    srcOtoCandidates.push(
      resolveMaybeRelative(rootPath, setConfig.reclistSource.otoFilePath)
    );
  }
  srcOtoCandidates.push(path.join(baseFolder, 'oto.ini'));

  const destOtoPath = path.join(setDir, 'oto.ini');
  for (const candidateOtoPath of srcOtoCandidates) {
    if (await fileExists(candidateOtoPath)) {
      const sameFile =
        path.resolve(candidateOtoPath) === path.resolve(destOtoPath);
      const buf = await fs.readFile(candidateOtoPath);
      const { text, detectedEncoding } = decodeTextBuffer(buf, 'auto');

      if (!sameFile || setConfig.aliasSuffix || detectedEncoding !== 'utf-8') {
        const otoEntries = parseOtoIni(text);
        const serialized = serializeOtoIni(otoEntries, setConfig.aliasSuffix);
        await fs.writeFile(destOtoPath, serialized, 'utf8');
      }
      break;
    }
  }

  const optionalCompanions = [
    'presamp.ini',
    'presampCHN.ini',
    'mkototemp.ini',
    'OREMO-comment.txt'
  ];
  for (const fileName of optionalCompanions) {
    const srcPath =
      fileName === 'OREMO-comment.txt' &&
      setConfig.reclistSource.commentFilePath
        ? resolveMaybeRelative(
            rootPath,
            setConfig.reclistSource.commentFilePath
          )
        : path.join(baseFolder, fileName);

    if (!(await fileExists(srcPath))) {
      continue;
    }
    const destPath = path.join(setDir, fileName);
    const buf = await fs.readFile(srcPath);
    const { text, detectedEncoding } = decodeTextBuffer(buf, 'auto');
    const cleanUtf8 = text.endsWith('\n') ? text : `${text}\n`;

    if (
      path.resolve(srcPath) !== path.resolve(destPath) ||
      detectedEncoding !== 'utf-8'
    ) {
      await fs.writeFile(destPath, cleanUtf8, 'utf8');
    }
    if (setDir !== rootPath && /^presamp.*\.ini$/i.test(fileName)) {
      await fs.writeFile(path.join(rootPath, fileName), cleanUtf8, 'utf8');
    }
  }
}

export async function syncSingerScaffolding(
  manifest: AieProjectManifest,
  resourcesRoot?: string
): Promise<void> {
  const rootPath = path.resolve(manifest.rootPath);
  await fs.mkdir(rootPath, { recursive: true });

  const reclistsRoot = resolveReclistsRootSync(resourcesRoot);
  const flags = {
    ...DEFAULT_SINGER_FILES,
    ...manifest.singerFiles
  };

  // 1. Clean UTF-8 character.txt (only when enabled; never delete existing file when unchecked)
  if (flags.characterTxt) {
    await writeCharacterTxt(rootPath, manifest);
  }

  // 2. Clean UTF-8 OpenUtau character.yaml (only when enabled)
  if (flags.characterYaml) {
    const builtinReclists = await listBuiltinReclists(resourcesRoot);
    const charYamlManifest = buildCharacterYamlManifest(
      manifest,
      builtinReclists
    );
    const yamlContent = serializeCharacterYaml(charYamlManifest);
    await fs.writeFile(
      path.join(rootPath, 'character.yaml'),
      yamlContent,
      'utf8'
    );
  }

  // 3. Clean UTF-8 prefix.map (only when enabled)
  if (flags.prefixMap) {
    const prefixMapContent = buildPrefixMap(manifest.sets);
    await fs.writeFile(
      path.join(rootPath, 'prefix.map'),
      prefixMapContent,
      'utf8'
    );
  }

  // 4. Companion files per set when generateCompanionFiles is enabled
  for (const setConfig of manifest.sets) {
    const setDir = resolveSetDirectory(rootPath, setConfig);
    await fs.mkdir(setDir, { recursive: true });
    if (setConfig.generateCompanionFiles) {
      await copyCompanionFilesForSet(rootPath, setConfig, reclistsRoot);
    }
  }
}
