import type { AieBridgeApi } from '@shared/types';
import { contextBridge, ipcRenderer } from 'electron';

const notImplemented = (method: string): Promise<never> =>
  Promise.reject(new Error(`IPC handler not yet wired: ${method}`));

const api: AieBridgeApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getSettings: () => notImplemented('app.getSettings'),
    updateSettings: () => notImplemented('app.updateSettings'),
    toggleDevTools: () => ipcRenderer.invoke('app:toggle-devtools'),
    exportDiagnosticZip: () => notImplemented('app.exportDiagnosticZip'),
    getOssLicenses: () => notImplemented('app.getOssLicenses'),
    openChromiumNotices: () => notImplemented('app.openChromiumNotices')
  },
  project: {
    getRecentProjects: () => notImplemented('project.getRecentProjects'),
    pickDirectory: () => notImplemented('project.pickDirectory'),
    pickFile: () => notImplemented('project.pickFile'),
    createProject: () => notImplemented('project.createProject'),
    openProject: () => notImplemented('project.openProject'),
    saveProject: () => notImplemented('project.saveProject'),
    upsertRecordingSet: () => notImplemented('project.upsertRecordingSet'),
    deleteRecordingSet: () => notImplemented('project.deleteRecordingSet'),
    getSetProgress: () => notImplemented('project.getSetProgress')
  },
  voicebank: {
    listBuiltinReclists: () => notImplemented('voicebank.listBuiltinReclists'),
    loadRecordingList: () => notImplemented('voicebank.loadRecordingList'),
    syncSingerScaffolding: () => notImplemented('voicebank.syncSingerScaffolding')
  },
  audioFile: {
    saveTake: () => notImplemented('audioFile.saveTake'),
    readTakeSamples: () => notImplemented('audioFile.readTakeSamples'),
    undoLastRetake: () => notImplemented('audioFile.undoLastRetake'),
    trashTake: () => notImplemented('audioFile.trashTake'),
    readAudioFileBytes: () => notImplemented('audioFile.readAudioFileBytes'),
    watchDirectory: () => () => undefined
  },
  shell: {
    revealInFileManager: () => notImplemented('shell.revealInFileManager'),
    openInExternalTool: () => notImplemented('shell.openInExternalTool'),
    openExternalUrl: () => notImplemented('shell.openExternalUrl')
  },
  updater: {
    checkForUpdates: () => notImplemented('updater.checkForUpdates'),
    installDownloadedUpdate: () => notImplemented('updater.installDownloadedUpdate'),
    onStatusChanged: () => () => undefined
  }
};

contextBridge.exposeInMainWorld('aie', api);
