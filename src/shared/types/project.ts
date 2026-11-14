import type { ScaleNote, SupportedEncoding } from './voicebank';

export type ReclistSource =
  | { kind: 'builtin'; builtinId: string }
  | {
      kind: 'custom';
      reclistPath: string;
      commentFilePath?: string;
      otoFilePath?: string;
      encoding: SupportedEncoding;
    };

export type GuideAudioMode =
  | { kind: 'none' }
  | {
      kind: 'pitched-metronome';
      bpm: number;
      leadInBeats: number;
      moraCount: number;
    }
  | {
      kind: 'custom-file';
      audioFilePath: string;
    };

export interface RecordingSetConfig {
  id: string;
  name: string;
  /** `'root'` writes `.wav` files directly in `<projectRoot>` (monopitch / ARPAsing base); `'subfolder'` writes in `<projectRoot>/<subfolderName>/` */
  targetLocation: 'root' | 'subfolder';
  subfolderName: string;
  scale: ScaleNote;
  /** Suffix appended to `oto.ini` aliases and `character.yaml` subbanks (e.g. `_G4`) */
  aliasSuffix: string;
  reclistSource: ReclistSource;
  guideAudio: GuideAudioMode;
  generateCompanionFiles: boolean;
  lastCursorIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface SingerFileSelection {
  characterTxt: boolean;
  characterYaml: boolean;
  prefixMap: boolean;
}

export const DEFAULT_SINGER_FILES: SingerFileSelection = {
  characterTxt: true,
  characterYaml: true,
  prefixMap: true
};

export interface AieProjectManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  rootPath: string;
  author?: string;
  defaultPhonemizer?: string;
  singerFiles?: SingerFileSelection;
  sets: RecordingSetConfig[];
  activeSetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SetProgressSummary {
  setId: string;
  recordedCount: number;
  totalCount: number;
  recordedFileNames: string[];
}

export interface RecentProjectSummary {
  projectPath: string;
  name: string;
  lastOpenedAt: string;
  activeSetName?: string;
  activeScale?: ScaleNote;
  recordedCount: number;
  totalCount: number;
  missingOnDisk: boolean;
}

/** Legacy `v0.x` `aie.config.json` shape for automatic migration */
export interface LegacyAieV0Config {
  name?: string;
  sets?: Array<{
    name?: string;
    scale?: string;
    recordingList?: {
      type?: 'built-in' | 'file';
      value?: string;
    };
  }>;
}
