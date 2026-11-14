import type { RecordedTakePayload, SavedTakeSummary } from './audio';
import type {
  AieProjectManifest,
  RecentProjectSummary,
  RecordingSetConfig,
  SetProgressSummary,
  SingerFileSelection
} from './project';
import type {
  AppSettings,
  DiagnosticExportResult,
  OssLicenseEntry,
  UpdateStatusInfo
} from './settings';
import type { ParsedRecordingListBundle, ReclistManifest } from './voicebank';

export interface AieBridgeApi {
  app: {
    getVersion(): Promise<string>;
    getSettings(): Promise<AppSettings>;
    updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>;
    toggleDevTools(): Promise<void>;
    exportDiagnosticZip(): Promise<DiagnosticExportResult>;
    getOssLicenses(): Promise<OssLicenseEntry[]>;
    openChromiumNotices(): Promise<void>;
  };
  project: {
    getRecentProjects(): Promise<RecentProjectSummary[]>;
    pickDirectory(title?: string): Promise<string | null>;
    pickFile(options?: {
      title?: string;
      extensions?: string[];
    }): Promise<string | null>;
    createProject(params: {
      name: string;
      rootPath: string;
      author?: string;
      singerFiles?: SingerFileSelection;
    }): Promise<AieProjectManifest>;
    openProject(rootPath: string): Promise<AieProjectManifest>;
    saveProject(manifest: AieProjectManifest): Promise<AieProjectManifest>;
    upsertRecordingSet(
      rootPath: string,
      setConfig: RecordingSetConfig
    ): Promise<AieProjectManifest>;
    deleteRecordingSet(params: {
      rootPath: string;
      setId: string;
      trashWavFiles: boolean;
    }): Promise<AieProjectManifest>;
    getSetProgress(
      rootPath: string,
      setConfig: RecordingSetConfig
    ): Promise<SetProgressSummary>;
  };
  voicebank: {
    listBuiltinReclists(): Promise<ReclistManifest[]>;
    loadRecordingList(
      rootPath: string,
      setConfig: RecordingSetConfig
    ): Promise<ParsedRecordingListBundle>;
    syncSingerScaffolding(manifest: AieProjectManifest): Promise<void>;
  };
  audioFile: {
    saveTake(payload: RecordedTakePayload): Promise<SavedTakeSummary>;
    readTakeSamples(params: {
      projectRootPath: string;
      relativeDirectory: string;
      fileName: string;
    }): Promise<{ samples: Float32Array; sampleRate: number } | null>;
    undoLastRetake(params: {
      projectRootPath: string;
      relativeDirectory: string;
      fileName: string;
    }): Promise<boolean>;
    trashTake(params: {
      projectRootPath: string;
      relativeDirectory: string;
      fileName: string;
    }): Promise<void>;
    readAudioFileBytes(filePath: string): Promise<Uint8Array>;
    watchDirectory(
      directoryPath: string,
      onChanged: (recordedFileNames: string[]) => void
    ): () => void;
  };
  shell: {
    revealInFileManager(targetPath: string): Promise<void>;
    openInExternalTool(params: {
      tool: 'vlabeler' | 'openutau';
      projectRootPath: string;
    }): Promise<{ ok: boolean; error?: string }>;
    openExternalUrl(url: string): Promise<void>;
  };
  updater: {
    checkForUpdates(): Promise<UpdateStatusInfo>;
    installDownloadedUpdate(): Promise<void>;
    onStatusChanged(listener: (info: UpdateStatusInfo) => void): () => void;
  };
}

declare global {
  interface Window {
    aie: AieBridgeApi;
  }
}
