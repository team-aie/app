/** Single source of truth for IPC channel names (imported by both preload and main). */
export const IPC = {
  app: {
    getVersion: 'aie:app:get-version',
    getSettings: 'aie:app:get-settings',
    updateSettings: 'aie:app:update-settings',
    toggleDevTools: 'aie:app:toggle-devtools',
    exportDiagnosticZip: 'aie:app:export-diagnostic-zip',
    getOssLicenses: 'aie:app:get-oss-licenses',
    openChromiumNotices: 'aie:app:open-chromium-notices'
  },
  project: {
    getRecentProjects: 'aie:project:get-recent',
    pickDirectory: 'aie:project:pick-directory',
    pickFile: 'aie:project:pick-file',
    createProject: 'aie:project:create',
    openProject: 'aie:project:open',
    saveProject: 'aie:project:save',
    upsertRecordingSet: 'aie:project:upsert-set',
    deleteRecordingSet: 'aie:project:delete-set',
    getSetProgress: 'aie:project:get-set-progress'
  },
  voicebank: {
    listBuiltinReclists: 'aie:voicebank:list-builtin-reclists',
    loadRecordingList: 'aie:voicebank:load-recording-list',
    syncSingerScaffolding: 'aie:voicebank:sync-singer-scaffolding'
  },
  audioFile: {
    saveTake: 'aie:audio:save-take',
    readTakeSamples: 'aie:audio:read-take-samples',
    undoLastRetake: 'aie:audio:undo-last-retake',
    trashTake: 'aie:audio:trash-take',
    readAudioFileBytes: 'aie:audio:read-file-bytes',
    watchStart: 'aie:audio:watch-start',
    watchStop: 'aie:audio:watch-stop',
    watchChanged: 'aie:audio:watch-changed'
  },
  shell: {
    revealInFileManager: 'aie:shell:reveal',
    openInExternalTool: 'aie:shell:open-external-tool',
    openExternalUrl: 'aie:shell:open-url'
  },
  updater: {
    checkForUpdates: 'aie:updater:check',
    installDownloadedUpdate: 'aie:updater:install',
    statusChanged: 'aie:updater:status-changed'
  }
} as const;
