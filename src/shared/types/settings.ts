import type { TransportRecordMode, WavFormatConfig } from './audio';

export type LocaleCode = 'en-US' | 'zh-CN' | 'ja-JP';
export type ThemeMode = 'system' | 'light' | 'dark';

export interface ExternalToolPaths {
  vLabelerPath: string;
  openUtauPath: string;
}

export interface StudioWorkflowPrefs {
  recordMode: TransportRecordMode;
  autoListenBack: boolean;
  autoAdvance: boolean;
  autoAdvanceDelayMs: number;
  guideEnabled: boolean;
  showOtoGrid: boolean;
  autoZoomQuietTakes: boolean;
}

export interface AppSettings {
  locale: LocaleCode;
  theme: ThemeMode;
  inputDeviceId: string;
  outputDeviceId: string;
  wavFormat: WavFormatConfig;
  workflow: StudioWorkflowPrefs;
  externalTools: ExternalToolPaths;
}

export interface OssLicenseEntry {
  name: string;
  version: string;
  license: string;
  author: string;
  repository: string;
  licenseText: string;
}

export interface DiagnosticExportResult {
  canceled: boolean;
  zipPath?: string;
}

export interface UpdateStatusInfo {
  status: 'idle' | 'checking' | 'available' | 'downloaded' | 'error';
  version?: string;
  releaseUrl?: string;
  canSelfInstall: boolean;
  message?: string;
}
