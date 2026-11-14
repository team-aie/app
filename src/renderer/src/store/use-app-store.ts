import type { ParseKeys } from 'i18next';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type {
  AieBridgeApi,
  AieProjectManifest,
  AppSettings,
  LocaleCode,
  ParsedRecordingListBundle,
  ReclistManifest,
  RecentProjectSummary,
  RecordingSetConfig,
  SetProgressSummary,
  StudioWorkflowPrefs,
  ThemeMode,
  UpdateStatusInfo
} from '@shared/types';
import { resolveLocale } from '@shared/i18n';
import { DEFAULT_APP_SETTINGS, resolveBridge } from './fallback-bridge';

export type AppScreen = 'hub' | 'project' | 'studio';
export type ModalId = 'audioSettings' | 'about';
export type ToastKind = 'info' | 'success' | 'warning' | 'error';

type AllNamespaces = ['common', 'hub', 'project', 'studio', 'settings'];
/** Any fully-qualified i18n key (`'hub:create.success'`, `'status.saved'` for common). */
export type ToastMessageKey = ParseKeys<AllNamespaces>;

export interface ToastItem {
  id: number;
  kind: ToastKind;
  messageKey: ToastMessageKey;
  values?: Record<string, string | number>;
}

export type StudioSessionState =
  | { status: 'idle' }
  | { status: 'loading'; setId: string }
  | {
      status: 'ready';
      setId: string;
      bundle: ParsedRecordingListBundle;
      recordedFileNames: string[];
    }
  | { status: 'error'; setId: string; error: string };

export interface AppStateData {
  bridge: AieBridgeApi;
  bridgeAvailable: boolean;
  initialized: boolean;
  version: string;
  settings: AppSettings;
  recentProjects: RecentProjectSummary[];
  builtinReclists: ReclistManifest[];
  manifest: AieProjectManifest | null;
  setProgress: Record<string, SetProgressSummary>;
  screen: AppScreen;
  studio: StudioSessionState;
  updateStatus: UpdateStatusInfo;
  toasts: ToastItem[];
  modals: Record<ModalId, boolean>;
  busy: { opening: boolean; creating: boolean };
}

export interface AppStateActions {
  init(): Promise<void>;
  setBridge(bridge: AieBridgeApi, available?: boolean): void;
  refreshRecentProjects(): Promise<void>;
  createProject(params: {
    name: string;
    rootPath: string;
    author?: string;
  }): Promise<AieProjectManifest | null>;
  openProject(rootPath: string): Promise<AieProjectManifest | null>;
  pickAndOpenProject(title?: string): Promise<AieProjectManifest | null>;
  continueLastSession(): Promise<void>;
  goToHub(): void;
  goToProject(): void;
  refreshSetProgress(): Promise<void>;
  upsertRecordingSet(config: RecordingSetConfig): Promise<AieProjectManifest | null>;
  deleteRecordingSet(setId: string, trashWavFiles: boolean): Promise<boolean>;
  enterStudio(setId: string): Promise<void>;
  updateCursor(index: number): void;
  flushPendingSave(): Promise<void>;
  updateSettings(partial: Partial<AppSettings>): Promise<void>;
  updateWorkflow(patch: Partial<StudioWorkflowPrefs>): Promise<void>;
  setLocale(locale: LocaleCode): Promise<void>;
  setTheme(theme: ThemeMode): Promise<void>;
  pushToast(toast: Omit<ToastItem, 'id'>): number;
  dismissToast(id: number): void;
  openModal(id: ModalId): void;
  closeModal(id: ModalId): void;
}

export type AppState = AppStateData & AppStateActions;
export type AppStore = UseBoundStore<StoreApi<AppState>>;

export const CURSOR_SAVE_DEBOUNCE_MS = 600;
const TOAST_LIMIT = 4;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function sortRecent(list: RecentProjectSummary[]): RecentProjectSummary[] {
  return [...list].sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
}

export function createInitialData(bridge: AieBridgeApi, bridgeAvailable: boolean): AppStateData {
  return {
    bridge,
    bridgeAvailable,
    initialized: false,
    version: '',
    settings: structuredClone(DEFAULT_APP_SETTINGS),
    recentProjects: [],
    builtinReclists: [],
    manifest: null,
    setProgress: {},
    screen: 'hub',
    studio: { status: 'idle' },
    updateStatus: { status: 'idle', canSelfInstall: false },
    toasts: [],
    modals: { audioSettings: false, about: false },
    busy: { opening: false, creating: false }
  };
}

/**
 * Creates the renderer app store. Pass a bridge to inject a mock in tests;
 * otherwise `window.aie` is used, falling back to an in-memory preview bridge.
 */
export function createAppStore(
  bridgeOverride?: AieBridgeApi,
  options: { detectLocale?: () => LocaleCode } = {}
): AppStore {
  const resolved = bridgeOverride
    ? { bridge: bridgeOverride, available: true }
    : resolveBridge();

  let toastSeq = 0;
  let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeUpdater: (() => void) | null = null;

  return create<AppState>()((set, get) => {
    const toastError = (error: unknown): void => {
      get().pushToast({
        kind: 'error',
        messageKey: 'status.error',
        values: { message: errorMessage(error) }
      });
    };

    const persistManifest = async (): Promise<void> => {
      const { manifest, bridge } = get();
      if (!manifest) {
        return;
      }
      try {
        await bridge.project.saveProject(manifest);
      } catch (error) {
        toastError(error);
      }
    };

    const loadProgress = async (manifest: AieProjectManifest): Promise<void> => {
      const { bridge } = get();
      const results = await Promise.allSettled(
        manifest.sets.map((setConfig) =>
          bridge.project.getSetProgress(manifest.rootPath, setConfig)
        )
      );
      const progress: Record<string, SetProgressSummary> = {};
      results.forEach((result, index) => {
        const setConfig = manifest.sets[index];
        if (result.status === 'fulfilled' && setConfig) {
          progress[setConfig.id] = result.value;
        }
      });
      if (get().manifest?.rootPath === manifest.rootPath) {
        set({ setProgress: progress });
      }
    };

    return {
      ...createInitialData(resolved.bridge, resolved.available),

      setBridge(bridge, available = true) {
        unsubscribeUpdater?.();
        unsubscribeUpdater = null;
        set({ bridge, bridgeAvailable: available });
      },

      async init() {
        const { bridge } = get();
        const [version, settings, recent, reclists] = await Promise.allSettled([
          bridge.app.getVersion(),
          bridge.app.getSettings(),
          bridge.project.getRecentProjects(),
          bridge.voicebank.listBuiltinReclists()
        ]);
        const fallbackSettings: AppSettings = {
          ...structuredClone(DEFAULT_APP_SETTINGS),
          locale: options.detectLocale?.() ?? DEFAULT_APP_SETTINGS.locale
        };
        set({
          initialized: true,
          version: version.status === 'fulfilled' ? version.value : '',
          settings: settings.status === 'fulfilled' ? settings.value : fallbackSettings,
          recentProjects: recent.status === 'fulfilled' ? sortRecent(recent.value) : [],
          builtinReclists: reclists.status === 'fulfilled' ? reclists.value : []
        });

        unsubscribeUpdater?.();
        try {
          unsubscribeUpdater = bridge.updater.onStatusChanged((info) =>
            set({ updateStatus: info })
          );
          const info = await bridge.updater.checkForUpdates();
          set({ updateStatus: info });
        } catch {
          // Update checks are best-effort and never block the booth.
        }
      },

      async refreshRecentProjects() {
        try {
          const recent = await get().bridge.project.getRecentProjects();
          set({ recentProjects: sortRecent(recent) });
        } catch (error) {
          toastError(error);
        }
      },

      async createProject(params) {
        set((state) => ({ busy: { ...state.busy, creating: true } }));
        try {
          const manifest = await get().bridge.project.createProject(params);
          set({ manifest, setProgress: {}, screen: 'project', studio: { status: 'idle' } });
          get().pushToast({
            kind: 'success',
            messageKey: 'hub:create.success',
            values: { name: manifest.name }
          });
          void get().refreshRecentProjects();
          return manifest;
        } catch (error) {
          toastError(error);
          return null;
        } finally {
          set((state) => ({ busy: { ...state.busy, creating: false } }));
        }
      },

      async openProject(rootPath) {
        await get().flushPendingSave();
        set((state) => ({ busy: { ...state.busy, opening: true } }));
        try {
          const manifest = await get().bridge.project.openProject(rootPath);
          set({ manifest, setProgress: {}, screen: 'project', studio: { status: 'idle' } });
          void loadProgress(manifest);
          void get().refreshRecentProjects();
          return manifest;
        } catch (error) {
          get().pushToast({
            kind: 'error',
            messageKey: 'hub:open.failed',
            values: { error: errorMessage(error) }
          });
          return null;
        } finally {
          set((state) => ({ busy: { ...state.busy, opening: false } }));
        }
      },

      async pickAndOpenProject(title) {
        let picked: string | null = null;
        try {
          picked = await get().bridge.project.pickDirectory(title);
        } catch (error) {
          toastError(error);
          return null;
        }
        if (!picked) {
          return null;
        }
        return get().openProject(picked);
      },

      async continueLastSession() {
        const last = get().recentProjects[0];
        if (!last) {
          return;
        }
        if (last.missingOnDisk) {
          get().pushToast({ kind: 'warning', messageKey: 'hub:continue.missing' });
          return;
        }
        const manifest = await get().openProject(last.projectPath);
        if (!manifest) {
          return;
        }
        const setId =
          manifest.sets.find((candidate) => candidate.id === manifest.activeSetId)?.id ??
          manifest.sets[0]?.id;
        if (!setId) {
          return;
        }
        await get().enterStudio(setId);
      },

      goToHub() {
        void get().flushPendingSave();
        set({ screen: 'hub', manifest: null, setProgress: {}, studio: { status: 'idle' } });
        void get().refreshRecentProjects();
      },

      goToProject() {
        void get().flushPendingSave();
        if (!get().manifest) {
          set({ screen: 'hub' });
          return;
        }
        set({ screen: 'project', studio: { status: 'idle' } });
        const manifest = get().manifest;
        if (manifest) {
          void loadProgress(manifest);
        }
      },

      async refreshSetProgress() {
        const manifest = get().manifest;
        if (manifest) {
          await loadProgress(manifest);
        }
      },

      async upsertRecordingSet(config) {
        const manifest = get().manifest;
        if (!manifest) {
          return null;
        }
        try {
          const next = await get().bridge.project.upsertRecordingSet(manifest.rootPath, config);
          set({ manifest: next });
          if (config.generateCompanionFiles) {
            try {
              await get().bridge.voicebank.syncSingerScaffolding(next);
            } catch (error) {
              toastError(error);
            }
          }
          get().pushToast({
            kind: 'success',
            messageKey: 'project:editor.saved',
            values: { name: config.name }
          });
          void loadProgress(next);
          return next;
        } catch (error) {
          toastError(error);
          return null;
        }
      },

      async deleteRecordingSet(setId, trashWavFiles) {
        const manifest = get().manifest;
        if (!manifest) {
          return false;
        }
        const removed = manifest.sets.find((candidate) => candidate.id === setId);
        try {
          const next = await get().bridge.project.deleteRecordingSet({
            rootPath: manifest.rootPath,
            setId,
            trashWavFiles
          });
          const { [setId]: _dropped, ...remainingProgress } = get().setProgress;
          set({ manifest: next, setProgress: remainingProgress });
          get().pushToast({
            kind: 'success',
            messageKey: 'project:remove.removed',
            values: { name: removed?.name ?? setId }
          });
          return true;
        } catch (error) {
          toastError(error);
          return false;
        }
      },

      async enterStudio(setId) {
        const manifest = get().manifest;
        const setConfig = manifest?.sets.find((candidate) => candidate.id === setId);
        if (!manifest || !setConfig) {
          return;
        }
        const nextManifest: AieProjectManifest = { ...manifest, activeSetId: setId };
        set({ manifest: nextManifest, screen: 'studio', studio: { status: 'loading', setId } });
        if (manifest.activeSetId !== setId) {
          void persistManifest();
        }
        const { bridge } = get();
        try {
          const [bundle, progress] = await Promise.all([
            bridge.voicebank.loadRecordingList(manifest.rootPath, setConfig),
            bridge.project
              .getSetProgress(manifest.rootPath, setConfig)
              .catch((): SetProgressSummary | null => null)
          ]);
          const current = get().studio;
          if (current.status !== 'loading' || current.setId !== setId) {
            return;
          }
          set((state) => ({
            studio: {
              status: 'ready',
              setId,
              bundle,
              recordedFileNames: progress?.recordedFileNames ?? []
            },
            setProgress: progress
              ? { ...state.setProgress, [setId]: progress }
              : state.setProgress
          }));
        } catch (error) {
          const current = get().studio;
          if (current.status === 'loading' && current.setId === setId) {
            set({ studio: { status: 'error', setId, error: errorMessage(error) } });
          }
        }
      },

      updateCursor(index) {
        const manifest = get().manifest;
        const setId = manifest?.activeSetId;
        if (!manifest || !setId) {
          return;
        }
        const target = manifest.sets.find((candidate) => candidate.id === setId);
        if (!target || target.lastCursorIndex === index) {
          return;
        }
        set({
          manifest: {
            ...manifest,
            sets: manifest.sets.map((candidate) =>
              candidate.id === setId ? { ...candidate, lastCursorIndex: index } : candidate
            )
          }
        });
        if (pendingSaveTimer) {
          clearTimeout(pendingSaveTimer);
        }
        pendingSaveTimer = setTimeout(() => {
          pendingSaveTimer = null;
          void persistManifest();
        }, CURSOR_SAVE_DEBOUNCE_MS);
      },

      async flushPendingSave() {
        if (!pendingSaveTimer) {
          return;
        }
        clearTimeout(pendingSaveTimer);
        pendingSaveTimer = null;
        await persistManifest();
      },

      async updateSettings(partial) {
        const previous = get().settings;
        set({ settings: { ...previous, ...partial } });
        try {
          const saved = await get().bridge.app.updateSettings(partial);
          set({ settings: { ...saved, ...partial } });
        } catch {
          // Keep the optimistic local value; the preload bridge may not be wired
          // yet (or running in preview mode). Settings remain usable in-session.
        }
      },

      async updateWorkflow(patch) {
        await get().updateSettings({ workflow: { ...get().settings.workflow, ...patch } });
      },

      async setLocale(locale) {
        await get().updateSettings({ locale });
      },

      async setTheme(theme) {
        await get().updateSettings({ theme });
      },

      pushToast(toast) {
        toastSeq += 1;
        const id = toastSeq;
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-TOAST_LIMIT) }));
        return id;
      },

      dismissToast(id) {
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
      },

      openModal(id) {
        set((state) => ({ modals: { ...state.modals, [id]: true } }));
      },

      closeModal(id) {
        set((state) => ({ modals: { ...state.modals, [id]: false } }));
      }
    };
  });
}

function detectNavigatorLocale(): LocaleCode {
  return resolveLocale(typeof navigator !== 'undefined' ? navigator.language : undefined);
}

/** Singleton renderer store. Tests can swap the bridge via `setBridge` or `resetAppStore`. */
export const useAppStore: AppStore = createAppStore(undefined, {
  detectLocale: detectNavigatorLocale
});

/** Resets the singleton store to a clean state backed by `bridge` (tests & preview). */
export function resetAppStore(bridge: AieBridgeApi, available = true): void {
  useAppStore.setState(createInitialData(bridge, available));
}

/** Selector helpers. */
export const selectActiveSet = (state: AppState): RecordingSetConfig | undefined =>
  state.manifest?.sets.find((candidate) => candidate.id === state.manifest?.activeSetId);
