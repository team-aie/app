import type { AieBridgeApi, UpdateStatusInfo } from '@shared/types';
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from './channels';

let watchCounter = 0;

const api: AieBridgeApi = {
  app: {
    getVersion: () => ipcRenderer.invoke(IPC.app.getVersion),
    getSettings: () => ipcRenderer.invoke(IPC.app.getSettings),
    updateSettings: (partial) => ipcRenderer.invoke(IPC.app.updateSettings, partial),
    toggleDevTools: () => ipcRenderer.invoke(IPC.app.toggleDevTools),
    exportDiagnosticZip: () => ipcRenderer.invoke(IPC.app.exportDiagnosticZip),
    getOssLicenses: () => ipcRenderer.invoke(IPC.app.getOssLicenses),
    openChromiumNotices: () => ipcRenderer.invoke(IPC.app.openChromiumNotices)
  },
  project: {
    getRecentProjects: () => ipcRenderer.invoke(IPC.project.getRecentProjects),
    pickDirectory: (title) => ipcRenderer.invoke(IPC.project.pickDirectory, title),
    pickFile: (options) => ipcRenderer.invoke(IPC.project.pickFile, options),
    createProject: (params) => ipcRenderer.invoke(IPC.project.createProject, params),
    openProject: (rootPath) => ipcRenderer.invoke(IPC.project.openProject, rootPath),
    saveProject: (manifest) => ipcRenderer.invoke(IPC.project.saveProject, manifest),
    upsertRecordingSet: (rootPath, setConfig) =>
      ipcRenderer.invoke(IPC.project.upsertRecordingSet, rootPath, setConfig),
    deleteRecordingSet: (params) => ipcRenderer.invoke(IPC.project.deleteRecordingSet, params),
    getSetProgress: (rootPath, setConfig) =>
      ipcRenderer.invoke(IPC.project.getSetProgress, rootPath, setConfig)
  },
  voicebank: {
    listBuiltinReclists: () => ipcRenderer.invoke(IPC.voicebank.listBuiltinReclists),
    loadRecordingList: (rootPath, setConfig) =>
      ipcRenderer.invoke(IPC.voicebank.loadRecordingList, rootPath, setConfig),
    syncSingerScaffolding: (manifest) => ipcRenderer.invoke(IPC.voicebank.syncSingerScaffolding, manifest)
  },
  audioFile: {
    saveTake: (payload) => ipcRenderer.invoke(IPC.audioFile.saveTake, payload),
    readTakeSamples: (params) => ipcRenderer.invoke(IPC.audioFile.readTakeSamples, params),
    undoLastRetake: (params) => ipcRenderer.invoke(IPC.audioFile.undoLastRetake, params),
    trashTake: (params) => ipcRenderer.invoke(IPC.audioFile.trashTake, params),
    readAudioFileBytes: async (filePath) => {
      const bytes: Uint8Array = await ipcRenderer.invoke(IPC.audioFile.readAudioFileBytes, filePath);
      return bytes;
    },
    watchDirectory: (directoryPath, onChanged) => {
      const watchId = `w${++watchCounter}`;
      const listener = (_event: IpcRendererEvent, id: string, names: string[]): void => {
        if (id === watchId) onChanged(names);
      };
      ipcRenderer.on(IPC.audioFile.watchChanged, listener);
      void ipcRenderer.invoke(IPC.audioFile.watchStart, watchId, directoryPath).catch(() => undefined);
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        ipcRenderer.removeListener(IPC.audioFile.watchChanged, listener);
        void ipcRenderer.invoke(IPC.audioFile.watchStop, watchId).catch(() => undefined);
      };
    }
  },
  shell: {
    revealInFileManager: (targetPath) => ipcRenderer.invoke(IPC.shell.revealInFileManager, targetPath),
    openInExternalTool: (params) => ipcRenderer.invoke(IPC.shell.openInExternalTool, params),
    openExternalUrl: (url) => ipcRenderer.invoke(IPC.shell.openExternalUrl, url)
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke(IPC.updater.checkForUpdates),
    installDownloadedUpdate: () => ipcRenderer.invoke(IPC.updater.installDownloadedUpdate),
    onStatusChanged: (listener) => {
      const handler = (_event: IpcRendererEvent, info: UpdateStatusInfo): void => listener(info);
      ipcRenderer.on(IPC.updater.statusChanged, handler);
      return () => {
        ipcRenderer.removeListener(IPC.updater.statusChanged, handler);
      };
    }
  }
};

contextBridge.exposeInMainWorld('aie', api);
