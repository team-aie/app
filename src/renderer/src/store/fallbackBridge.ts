import type {
  AieBridgeApi,
  AieProjectManifest,
  AppSettings,
  ParsedRecordingListBundle,
  ReclistManifest,
  RecentProjectSummary,
  RecordingSetConfig,
  SetProgressSummary,
  UpdateStatusInfo
} from '@shared/types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  locale: 'en-US',
  theme: 'system',
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  wavFormat: { sampleRate: 44100, bitDepth: 16, removeDcOffset: true },
  workflow: {
    recordMode: 'hold',
    autoListenBack: true,
    autoAdvance: false,
    autoAdvanceDelayMs: 400,
    guideEnabled: true,
    showOtoGrid: true,
    autoZoomQuietTakes: true
  },
  externalTools: { vLabelerPath: '', openUtauPath: '' }
};

export const PREVIEW_BUILTIN_RECLISTS: ReclistManifest[] = [
  {
    id: 'delta_eng_ver5',
    displayName: 'Delta English Ver.5 (CVVC)',
    version: '1.0.0',
    author: 'デルタ (Delta)',
    language: 'en',
    style: 'CVVC',
    defaultPhonemizer: 'OpenUtau.Plugin.Builtin.EnXsampaPhonemizer',
    reclistFile: 'デルタ式engver5_reclist.txt',
    readmeFile: 'README.md',
    companionFiles: ['mkototemp.ini'],
    homepageUrl: 'https://ch.nicovideo.jp/delta_kimigatame/blomaga/ar581614',
    termsNotice:
      'Included by arrangement with the original author (デルタ). Bundling in aie does not grant additional redistribution licenses beyond the author’s original terms.'
  },
  {
    id: 'dv_jpn_list_by_alex',
    displayName: 'Japanese CV/CVVC List (DeepVocal / UTAU)',
    version: '1.0.0',
    author: 'Alex',
    language: 'ja',
    style: 'CV / DeepVocal',
    defaultPhonemizer: 'OpenUtau.Core.DefaultPhonemizer',
    reclistFile: 'DV_JPN_list_by_Alex.txt',
    companionFiles: [],
    homepageUrl: '',
    termsNotice:
      'Included by arrangement with the original author (Alex). Bundling in aie does not grant additional redistribution licenses beyond the author’s original terms.'
  },
  {
    id: 'extended_cvvc_8lite',
    displayName: 'Extended Chinese CVVC 8-Mora Lite',
    version: '1.0.0',
    author: '残月 (Zanyue)',
    language: 'zh',
    style: 'CVVC (8-mora, 120 BPM)',
    defaultPhonemizer: 'OpenUtau.Plugin.Builtin.ChineseCVVCPhonemizer',
    recommendedBpm: 120,
    leadInMs: 1200,
    reclistFile: 'Reclist.txt',
    otoFile: 'oto.ini',
    companionFiles: ['oto.ini', 'presampCHN.ini'],
    homepageUrl: '',
    termsNotice:
      'Included by arrangement with the original author (残月). Bundling in aie does not grant additional redistribution licenses beyond the author’s original terms.'
  },
  {
    id: 'z_cvvc_normal',
    displayName: 'Z.CVVC Normal (Chinese)',
    version: '1.1.0',
    author: '残月 (Zanyue)',
    language: 'zh',
    style: 'CVVC',
    defaultPhonemizer: 'OpenUtau.Plugin.Builtin.ChineseCVVCPhonemizer',
    reclistFile: 'Reclist.txt',
    otoFile: 'oto.ini',
    companionFiles: ['oto.ini', 'presamp.ini'],
    homepageUrl: '',
    termsNotice:
      'Included by arrangement with the original author (残月). Bundling in aie does not grant additional redistribution licenses beyond the author’s original terms.'
  }
];

const PREVIEW_PROMPTS = ['_あかさたな', '_いきしちに', '_うくすつぬ', '_えけせてね', '_おこそとの'];

function previewBundle(): ParsedRecordingListBundle {
  return {
    entries: PREVIEW_PROMPTS.map((rawPrompt, index) => ({
      index,
      rawPrompt,
      fileStem: rawPrompt,
      fileName: `${rawPrompt}.wav`,
      syllables: []
    })),
    otoEntries: [],
    detectedEncoding: 'utf-8'
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * In-memory implementation of `window.aie` used when the Electron preload
 * bridge is absent (Vitest/jsdom, plain-browser `vite` preview). It never
 * touches the filesystem.
 */
export function createFallbackBridge(seed?: {
  settings?: AppSettings;
  projects?: AieProjectManifest[];
  recent?: RecentProjectSummary[];
}): AieBridgeApi {
  let settings: AppSettings = structuredClone(seed?.settings ?? DEFAULT_APP_SETTINGS);
  const projects = new Map<string, AieProjectManifest>();
  for (const project of seed?.projects ?? []) {
    projects.set(project.rootPath, structuredClone(project));
  }
  let recent: RecentProjectSummary[] = structuredClone(seed?.recent ?? []);

  const touchRecent = (manifest: AieProjectManifest): void => {
    const activeSet =
      manifest.sets.find((set) => set.id === manifest.activeSetId) ?? manifest.sets[0];
    const summary: RecentProjectSummary = {
      projectPath: manifest.rootPath,
      name: manifest.name,
      lastOpenedAt: nowIso(),
      activeSetName: activeSet?.name,
      activeScale: activeSet?.scale,
      recordedCount: 0,
      totalCount: activeSet ? PREVIEW_PROMPTS.length : 0,
      missingOnDisk: false
    };
    recent = [summary, ...recent.filter((item) => item.projectPath !== manifest.rootPath)];
  };

  const requireProject = (rootPath: string): AieProjectManifest => {
    const project = projects.get(rootPath);
    if (!project) {
      throw new Error(`No aie project at ${rootPath}`);
    }
    return project;
  };

  const store = (manifest: AieProjectManifest): AieProjectManifest => {
    const next = { ...manifest, updatedAt: nowIso() };
    projects.set(next.rootPath, next);
    return structuredClone(next);
  };

  const idleUpdate: UpdateStatusInfo = { status: 'idle', canSelfInstall: false };

  return {
    app: {
      getVersion: async () => '1.0.0-preview',
      getSettings: async () => structuredClone(settings),
      updateSettings: async (partial) => {
        settings = { ...settings, ...structuredClone(partial) };
        return structuredClone(settings);
      },
      toggleDevTools: async () => undefined,
      exportDiagnosticZip: async () => ({ canceled: true }),
      getOssLicenses: async () => [],
      openChromiumNotices: async () => undefined
    },
    project: {
      getRecentProjects: async () => structuredClone(recent),
      pickDirectory: async () => null,
      pickFile: async () => null,
      createProject: async ({ name, rootPath, author }) => {
        const createdAt = nowIso();
        const manifest: AieProjectManifest = {
          schemaVersion: 1,
          id: makeId('project'),
          name,
          rootPath,
          author,
          sets: [],
          createdAt,
          updatedAt: createdAt
        };
        projects.set(rootPath, manifest);
        touchRecent(manifest);
        return structuredClone(manifest);
      },
      openProject: async (rootPath) => {
        const manifest = requireProject(rootPath);
        touchRecent(manifest);
        return structuredClone(manifest);
      },
      saveProject: async (manifest) => store(manifest),
      upsertRecordingSet: async (rootPath, setConfig: RecordingSetConfig) => {
        const manifest = requireProject(rootPath);
        const exists = manifest.sets.some((set) => set.id === setConfig.id);
        const sets = exists
          ? manifest.sets.map((set) => (set.id === setConfig.id ? setConfig : set))
          : [...manifest.sets, setConfig];
        return store({ ...manifest, sets, activeSetId: manifest.activeSetId ?? setConfig.id });
      },
      deleteRecordingSet: async ({ rootPath, setId }) => {
        const manifest = requireProject(rootPath);
        const sets = manifest.sets.filter((set) => set.id !== setId);
        return store({
          ...manifest,
          sets,
          activeSetId: manifest.activeSetId === setId ? sets[0]?.id : manifest.activeSetId
        });
      },
      getSetProgress: async (_rootPath, setConfig): Promise<SetProgressSummary> => ({
        setId: setConfig.id,
        recordedCount: 0,
        totalCount: PREVIEW_PROMPTS.length,
        recordedFileNames: []
      })
    },
    voicebank: {
      listBuiltinReclists: async () => structuredClone(PREVIEW_BUILTIN_RECLISTS),
      loadRecordingList: async () => previewBundle(),
      syncSingerScaffolding: async () => undefined
    },
    audioFile: {
      saveTake: async (payload) => ({
        fullPath: `${payload.projectRootPath}/${payload.relativeDirectory}/${payload.fileName}`,
        durationMs: 0,
        peakDb: -Infinity,
        clipped: false,
        earlyCutoffWarning: false,
        canUndoPreviousTake: false
      }),
      readTakeSamples: async () => null,
      undoLastRetake: async () => false,
      trashTake: async () => undefined,
      readAudioFileBytes: async () => new Uint8Array(),
      watchDirectory: () => () => undefined
    },
    shell: {
      revealInFileManager: async () => undefined,
      openInExternalTool: async () => ({ ok: false, error: 'Preview mode' }),
      openExternalUrl: async () => undefined
    },
    updater: {
      checkForUpdates: async () => idleUpdate,
      installDownloadedUpdate: async () => undefined,
      onStatusChanged: () => () => undefined
    }
  };
}

/** Returns the Electron preload bridge if present, otherwise an in-memory fallback. */
export function resolveBridge(): { bridge: AieBridgeApi; available: boolean } {
  if (typeof window !== 'undefined' && (window as Partial<Window>).aie) {
    return { bridge: window.aie, available: true };
  }
  return { bridge: createFallbackBridge(), available: false };
}
