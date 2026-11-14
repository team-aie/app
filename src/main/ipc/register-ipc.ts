import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import type {
  AieProjectManifest,
  RecordedTakePayload,
  RecordingSetConfig,
  UpdateStatusInfo
} from '@shared/types';
import { IPC } from '../../preload/channels';
import type { AppStateStore } from '../services/app-state';
import type { AudioStorage } from '../services/audio-storage';
import { watchWavDirectory, type DirectoryWatcherHandle } from '../services/audio-storage/directory-watcher';
import type { Diagnostics } from '../services/diagnostics';
import type { ShellHandoff } from '../services/shell-handoff';
import type { UpdaterService } from '../services/updater';
import type { DomainServices } from './domain-services-adapter';

export interface IpcDependencies {
  appState: AppStateStore;
  domain: DomainServices;
  audioStorage: AudioStorage;
  diagnostics: Pick<
    Diagnostics,
    'exportDiagnosticZip' | 'toggleDevTools' | 'getOssLicenses' | 'openChromiumNotices'
  >;
  shellHandoff: ShellHandoff;
  updater: UpdaterService;
  getMainWindow: () => BrowserWindow | null;
  logger: { info(...a: unknown[]): void; warn(...a: unknown[]): void; error(...a: unknown[]): void };
}

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.aif', '.aiff']);
const MAX_AUDIO_FILE_BYTES = 1024 * 1024 * 1024;

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || value === '') throw new Error(`${name} must be a non-empty string`);
  return value;
}

function obj(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function takeLocation(value: unknown): { projectRootPath: string; relativeDirectory: string; fileName: string } {
  const v = obj(value, 'take location');
  if (typeof v['relativeDirectory'] !== 'string') throw new Error('relativeDirectory must be a string');
  return {
    projectRootPath: str(v['projectRootPath'], 'projectRootPath'),
    relativeDirectory: v['relativeDirectory'],
    fileName: str(v['fileName'], 'fileName')
  };
}

/** Registers every `AieBridgeApi` channel. Returns a disposer that removes handlers and closes watchers. */
export function registerIpc(deps: IpcDependencies): () => void {
  const { appState, domain, audioStorage, diagnostics, shellHandoff, updater } = deps;
  const channels: string[] = [];
  const handle = (channel: string, fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void => {
    channels.push(channel);
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await fn(event, ...args);
      } catch (error) {
        deps.logger.warn(`IPC ${channel} failed`, error);
        throw error;
      }
    });
  };

  const dialogParent = (): BrowserWindow | undefined => deps.getMainWindow() ?? undefined;

  const rememberProject = async (manifest: AieProjectManifest): Promise<AieProjectManifest> => {
    let progress;
    const active = manifest.sets.find((s) => s.id === manifest.activeSetId) ?? manifest.sets[0];
    if (active) {
      progress = await domain.project.getSetProgress(manifest.rootPath, active).catch(() => undefined);
    }
    await appState.touchRecentProject(manifest, progress);
    return manifest;
  };

  // ---- app ----
  handle(IPC.app.getVersion, () => app.getVersion());
  handle(IPC.app.getSettings, () => appState.getSettings());
  handle(IPC.app.updateSettings, (_e, partial) => appState.updateSettings(partial));
  handle(IPC.app.toggleDevTools, () => diagnostics.toggleDevTools());
  handle(IPC.app.exportDiagnosticZip, () => diagnostics.exportDiagnosticZip());
  handle(IPC.app.getOssLicenses, () => diagnostics.getOssLicenses());
  handle(IPC.app.openChromiumNotices, () => diagnostics.openChromiumNotices());

  // ---- project ----
  handle(IPC.project.getRecentProjects, () => appState.getRecentProjects());
  handle(IPC.project.pickDirectory, async (_e, title) => {
    const options = {
      title: typeof title === 'string' ? title : undefined,
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    };
    const parent = dialogParent();
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  handle(IPC.project.pickFile, async (_e, rawOptions) => {
    const o = (typeof rawOptions === 'object' && rawOptions !== null ? rawOptions : {}) as {
      title?: unknown;
      extensions?: unknown;
    };
    const extensions = Array.isArray(o.extensions)
      ? o.extensions.filter((x): x is string => typeof x === 'string').map((x) => x.replace(/^\./, ''))
      : [];
    const options = {
      title: typeof o.title === 'string' ? o.title : undefined,
      properties: ['openFile'] as Array<'openFile'>,
      filters: extensions.length > 0 ? [{ name: 'Files', extensions }] : undefined
    };
    const parent = dialogParent();
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  handle(IPC.project.createProject, async (_e, params) => {
    const p = obj(params, 'params');
    const manifest = await domain.project.createProject({
      name: str(p['name'], 'name'),
      rootPath: str(p['rootPath'], 'rootPath'),
      ...(typeof p['author'] === 'string' ? { author: p['author'] } : {})
    });
    return rememberProject(manifest);
  });
  handle(IPC.project.openProject, async (_e, rootPath) =>
    rememberProject(await domain.project.openProject(str(rootPath, 'rootPath')))
  );
  handle(IPC.project.saveProject, async (_e, manifest) =>
    rememberProject(await domain.project.saveProject(manifest as AieProjectManifest))
  );
  handle(IPC.project.upsertRecordingSet, async (_e, rootPath, setConfig) =>
    rememberProject(
      await domain.project.upsertRecordingSet(str(rootPath, 'rootPath'), setConfig as RecordingSetConfig)
    )
  );
  handle(IPC.project.deleteRecordingSet, async (_e, params) => {
    const p = obj(params, 'params');
    return rememberProject(
      await domain.project.deleteRecordingSet({
        rootPath: str(p['rootPath'], 'rootPath'),
        setId: str(p['setId'], 'setId'),
        trashWavFiles: p['trashWavFiles'] === true
      })
    );
  });
  handle(IPC.project.getSetProgress, async (_e, rootPath, setConfig) => {
    const root = str(rootPath, 'rootPath');
    const progress = await domain.project.getSetProgress(root, setConfig as RecordingSetConfig);
    await appState.updateRecentProgress(root, progress);
    return progress;
  });

  // ---- voicebank ----
  handle(IPC.voicebank.listBuiltinReclists, () => domain.voicebank.listBuiltinReclists());
  handle(IPC.voicebank.loadRecordingList, (_e, rootPath, setConfig) =>
    domain.voicebank.loadRecordingList(str(rootPath, 'rootPath'), setConfig as RecordingSetConfig)
  );
  handle(IPC.voicebank.syncSingerScaffolding, (_e, manifest) =>
    domain.voicebank.syncSingerScaffolding(manifest as AieProjectManifest)
  );

  // ---- audio files ----
  handle(IPC.audioFile.saveTake, (_e, payload) => audioStorage.saveTake(payload as RecordedTakePayload));
  handle(IPC.audioFile.readTakeSamples, (_e, params) => audioStorage.readTakeSamples(takeLocation(params)));
  handle(IPC.audioFile.undoLastRetake, (_e, params) => audioStorage.undoLastRetake(takeLocation(params)));
  handle(IPC.audioFile.trashTake, (_e, params) => audioStorage.trashTake(takeLocation(params)));
  handle(IPC.audioFile.readAudioFileBytes, async (_e, filePath) => {
    const target = path.resolve(str(filePath, 'filePath'));
    if (!AUDIO_EXTENSIONS.has(path.extname(target).toLowerCase())) {
      throw new Error('Only audio files can be read');
    }
    const stat = await fs.promises.stat(target);
    if (!stat.isFile() || stat.size > MAX_AUDIO_FILE_BYTES) throw new Error('Unsupported audio file');
    const buffer = await fs.promises.readFile(target);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  });

  const watchers = new Map<string, DirectoryWatcherHandle>();
  const closeWatcher = (key: string): void => {
    const w = watchers.get(key);
    if (w) {
      watchers.delete(key);
      void w.close();
    }
  };
  const hooked = new WeakSet<WebContents>();
  handle(IPC.audioFile.watchStart, (event, watchId, directoryPath) => {
    const sender = event.sender;
    const key = `${sender.id}:${str(watchId, 'watchId')}`;
    closeWatcher(key);
    watchers.set(
      key,
      watchWavDirectory({
        directory: path.resolve(str(directoryPath, 'directoryPath')),
        onChanged: (names) => {
          if (!sender.isDestroyed()) sender.send(IPC.audioFile.watchChanged, watchId, names);
        },
        onError: (error) => deps.logger.warn('Directory watcher error', error)
      })
    );
    if (!hooked.has(sender)) {
      hooked.add(sender);
      sender.once('destroyed', () => {
        for (const k of [...watchers.keys()]) if (k.startsWith(`${sender.id}:`)) closeWatcher(k);
      });
    }
  });
  handle(IPC.audioFile.watchStop, (event, watchId) => {
    closeWatcher(`${event.sender.id}:${str(watchId, 'watchId')}`);
  });

  // ---- shell ----
  handle(IPC.shell.revealInFileManager, (_e, targetPath) =>
    shellHandoff.revealInFileManager(str(targetPath, 'targetPath'))
  );
  handle(IPC.shell.openInExternalTool, (_e, params) => {
    const p = obj(params, 'params');
    return shellHandoff.openInExternalTool({
      tool: p['tool'] as 'vlabeler' | 'openutau',
      projectRootPath: str(p['projectRootPath'], 'projectRootPath')
    });
  });
  handle(IPC.shell.openExternalUrl, (_e, url) => shellHandoff.openExternalUrl(str(url, 'url')));

  // ---- updater ----
  handle(IPC.updater.checkForUpdates, () => updater.checkForUpdates());
  handle(IPC.updater.installDownloadedUpdate, () => updater.installDownloadedUpdate());

  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel);
    for (const key of [...watchers.keys()]) closeWatcher(key);
  };
}

/** Broadcasts updater status to every open window. */
export function broadcastUpdateStatus(info: UpdateStatusInfo): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.updater.statusChanged, info);
  }
}
