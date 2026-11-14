import fs from 'node:fs';
import path from 'node:path';
import type {
  AppSettings,
  LocaleCode,
  RecentProjectSummary,
  SetProgressSummary
} from '@shared/types';

export const APP_STATE_FILE_NAME = 'app-state.json';
export const MAX_RECENT_PROJECTS = 12;

/** Persisted recent-project row (`missingOnDisk` is always recomputed on read). */
export interface StoredRecentProject extends Omit<RecentProjectSummary, 'missingOnDisk'> {
  activeSetId?: string;
}

interface AppStateFile {
  version: 1;
  settings: AppSettings;
  recentProjects: StoredRecentProject[];
}

export type PartialAppSettings = {
  [K in keyof AppSettings]?: AppSettings[K] extends object ? Partial<AppSettings[K]> : AppSettings[K];
};

/** Maps any BCP-47 system locale (`zh-TW`, `ja`, `en-GB`, ...) onto a supported `LocaleCode`. */
export function mapSystemLocale(systemLocale: string | undefined): LocaleCode {
  const lower = (systemLocale ?? '').toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('ja')) return 'ja-JP';
  return 'en-US';
}

export function createDefaultSettings(systemLocale?: string): AppSettings {
  return {
    locale: mapSystemLocale(systemLocale),
    theme: 'system',
    inputDeviceId: 'default',
    outputDeviceId: 'default',
    wavFormat: { sampleRate: 44100, bitDepth: 16, removeDcOffset: true },
    workflow: {
      recordMode: 'hold',
      autoListenBack: true,
      autoAdvance: false,
      autoAdvanceDelayMs: 600,
      guideEnabled: true,
      showOtoGrid: true,
      autoZoomQuietTakes: false
    },
    externalTools: { vLabelerPath: '', openUtauPath: '' }
  };
}

const LOCALES: readonly LocaleCode[] = ['en-US', 'zh-CN', 'ja-JP'];
const THEMES: readonly AppSettings['theme'][] = ['system', 'light', 'dark'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merges untrusted partial settings over a known-good base. Every field is
 * type-checked so a corrupt `app-state.json` or a bad renderer payload can never
 * poison the persisted settings.
 */
export function mergeSettings(base: AppSettings, patch: unknown): AppSettings {
  if (!isRecord(patch)) return base;
  const next: AppSettings = {
    ...base,
    wavFormat: { ...base.wavFormat },
    workflow: { ...base.workflow },
    externalTools: { ...base.externalTools }
  };

  if (LOCALES.includes(patch['locale'] as LocaleCode)) next.locale = patch['locale'] as LocaleCode;
  if (THEMES.includes(patch['theme'] as AppSettings['theme'])) {
    next.theme = patch['theme'] as AppSettings['theme'];
  }
  if (typeof patch['inputDeviceId'] === 'string') next.inputDeviceId = patch['inputDeviceId'];
  if (typeof patch['outputDeviceId'] === 'string') next.outputDeviceId = patch['outputDeviceId'];

  const wav = patch['wavFormat'];
  if (isRecord(wav)) {
    if (wav['sampleRate'] === 44100 || wav['sampleRate'] === 48000) {
      next.wavFormat.sampleRate = wav['sampleRate'];
    }
    if (wav['bitDepth'] === 16 || wav['bitDepth'] === 24 || wav['bitDepth'] === 32) {
      next.wavFormat.bitDepth = wav['bitDepth'];
    }
    if (typeof wav['removeDcOffset'] === 'boolean') next.wavFormat.removeDcOffset = wav['removeDcOffset'];
  }

  const wf = patch['workflow'];
  if (isRecord(wf)) {
    if (wf['recordMode'] === 'hold' || wf['recordMode'] === 'toggle') {
      next.workflow.recordMode = wf['recordMode'];
    }
    for (const key of [
      'autoListenBack',
      'autoAdvance',
      'guideEnabled',
      'showOtoGrid',
      'autoZoomQuietTakes'
    ] as const) {
      if (typeof wf[key] === 'boolean') next.workflow[key] = wf[key];
    }
    const delay = wf['autoAdvanceDelayMs'];
    if (typeof delay === 'number' && Number.isFinite(delay)) {
      next.workflow.autoAdvanceDelayMs = Math.min(5000, Math.max(0, Math.round(delay)));
    }
  }

  const tools = patch['externalTools'];
  if (isRecord(tools)) {
    if (typeof tools['vLabelerPath'] === 'string') next.externalTools.vLabelerPath = tools['vLabelerPath'];
    if (typeof tools['openUtauPath'] === 'string') next.externalTools.openUtauPath = tools['openUtauPath'];
  }
  return next;
}

function sanitizeRecent(value: unknown): StoredRecentProject[] {
  if (!Array.isArray(value)) return [];
  const rows: StoredRecentProject[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item['projectPath'] !== 'string' || item['projectPath'] === '') continue;
    const row: StoredRecentProject = {
      projectPath: item['projectPath'],
      name: typeof item['name'] === 'string' ? item['name'] : path.basename(item['projectPath']),
      lastOpenedAt:
        typeof item['lastOpenedAt'] === 'string' ? item['lastOpenedAt'] : new Date(0).toISOString(),
      recordedCount: typeof item['recordedCount'] === 'number' ? item['recordedCount'] : 0,
      totalCount: typeof item['totalCount'] === 'number' ? item['totalCount'] : 0
    };
    if (typeof item['activeSetName'] === 'string') row.activeSetName = item['activeSetName'];
    if (typeof item['activeScale'] === 'string') row.activeScale = item['activeScale'] as StoredRecentProject['activeScale'];
    if (typeof item['activeSetId'] === 'string') row.activeSetId = item['activeSetId'];
    rows.push(row);
  }
  return rows;
}

export interface ProjectLike {
  name: string;
  rootPath: string;
  activeSetId?: string;
  sets: Array<{ id: string; name: string; scale: StoredRecentProject['activeScale'] }>;
}

export interface AppStateStore {
  getSettings(): AppSettings;
  updateSettings(partial: unknown): Promise<AppSettings>;
  getRecentProjects(): Promise<RecentProjectSummary[]>;
  /** Records/refreshes a project in the recent list (most recent first). */
  touchRecentProject(project: ProjectLike, progress?: SetProgressSummary): Promise<void>;
  updateRecentProgress(projectPath: string, progress: SetProgressSummary): Promise<void>;
  removeRecentProject(projectPath: string): Promise<void>;
  flush(): Promise<void>;
}

export interface AppStateOptions {
  /** Absolute path of `app-state.json` (normally `app.getPath('userData')/app-state.json`). */
  filePath: string;
  systemLocale?: string;
  now?: () => Date;
}

/** Atomic JSON write: temp file in the same directory, then `rename`. */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.promises.rename(tmp, filePath);
  } catch (error) {
    await fs.promises.rm(tmp, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function createAppStateStore(options: AppStateOptions): AppStateStore {
  const now = options.now ?? (() => new Date());
  const defaults = createDefaultSettings(options.systemLocale);

  let state: AppStateFile = { version: 1, settings: defaults, recentProjects: [] };
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(options.filePath, 'utf8'));
    if (isRecord(parsed)) {
      state = {
        version: 1,
        settings: mergeSettings(defaults, parsed['settings']),
        recentProjects: sanitizeRecent(parsed['recentProjects'])
      };
    }
  } catch {
    // Missing or corrupt file -> start from defaults (the next write replaces it).
  }

  // Writes are serialized so concurrent updates can never interleave temp files.
  let writeChain: Promise<void> = Promise.resolve();
  const persist = (): Promise<void> => {
    const snapshot = JSON.stringify(state);
    writeChain = writeChain
      .catch(() => undefined)
      .then(() => writeJsonAtomic(options.filePath, JSON.parse(snapshot)));
    return writeChain;
  };

  const sortRecent = (): void => {
    state.recentProjects.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    state.recentProjects = state.recentProjects.slice(0, MAX_RECENT_PROJECTS);
  };

  return {
    getSettings: () => structuredClone(state.settings),
    async updateSettings(partial) {
      state = { ...state, settings: mergeSettings(state.settings, partial) };
      await persist();
      return structuredClone(state.settings);
    },
    async getRecentProjects() {
      return Promise.all(
        state.recentProjects.map(async (row): Promise<RecentProjectSummary> => {
          const missingOnDisk = !(await fs.promises
            .stat(row.projectPath)
            .then((s) => s.isDirectory())
            .catch(() => false));
          const { activeSetId: _activeSetId, ...summary } = row;
          return { ...summary, missingOnDisk };
        })
      );
    },
    async touchRecentProject(project, progress) {
      const activeSet = project.sets.find((s) => s.id === project.activeSetId) ?? project.sets[0];
      const previous = state.recentProjects.find((r) => r.projectPath === project.rootPath);
      const sameSet = previous !== undefined && previous.activeSetId === activeSet?.id;
      const row: StoredRecentProject = {
        projectPath: project.rootPath,
        name: project.name,
        lastOpenedAt: now().toISOString(),
        recordedCount: progress?.recordedCount ?? (sameSet ? previous.recordedCount : 0),
        totalCount: progress?.totalCount ?? (sameSet ? previous.totalCount : 0)
      };
      if (activeSet) {
        row.activeSetId = activeSet.id;
        row.activeSetName = activeSet.name;
        row.activeScale = activeSet.scale;
      }
      state.recentProjects = [
        row,
        ...state.recentProjects.filter((r) => r.projectPath !== project.rootPath)
      ];
      sortRecent();
      await persist();
    },
    async updateRecentProgress(projectPath, progress) {
      const row = state.recentProjects.find((r) => r.projectPath === projectPath);
      if (!row || (row.activeSetId !== undefined && row.activeSetId !== progress.setId)) return;
      if (row.recordedCount === progress.recordedCount && row.totalCount === progress.totalCount) return;
      row.recordedCount = progress.recordedCount;
      row.totalCount = progress.totalCount;
      await persist();
    },
    async removeRecentProject(projectPath) {
      state.recentProjects = state.recentProjects.filter((r) => r.projectPath !== projectPath);
      await persist();
    },
    flush: () => writeChain.catch(() => undefined)
  };
}
