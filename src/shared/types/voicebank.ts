export const PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
] as const;

export type PitchClass = (typeof PITCH_CLASSES)[number];
export type OctaveNumber = 2 | 3 | 4 | 5;
export type ScaleNote = `${PitchClass}${OctaveNumber}`;

export type SupportedEncoding =
  | 'auto'
  | 'utf-8'
  | 'utf-16le'
  | 'utf-16be'
  | 'shift_jis'
  | 'gb18030';

export interface ReclistManifest {
  id: string;
  displayName: string;
  version: string;
  author: string;
  language: 'en' | 'zh' | 'ja' | 'multi';
  style: string;
  defaultPhonemizer: string;
  recommendedBpm?: number;
  leadInMs?: number;
  reclistFile: string;
  otoFile?: string;
  readmeFile?: string;
  companionFiles: string[];
  homepageUrl: string;
  termsNotice: string;
}

export interface ReclistEntry {
  /** Zero-based index in the active recording list */
  index: number;
  /** Raw prompt token from the reclist line */
  rawPrompt: string;
  /** Sanitized base filename without `.wav` extension */
  fileStem: string;
  /** Target `.wav` filename on disk (e.g. `_a_ba_pa.wav` or `_a_ba_pa_1.wav`) */
  fileName: string;
  /** Optional inline `@comment` from OREMO reclist control lines */
  inlineComment?: string;
  /** Optional pronunciation/sight-reading hint from `OREMO-comment.txt` or built-in phoneme guide */
  pronunciationHint?: string;
  /** Parsed syllable/alias chips from companion `oto.ini` matching `fileName` */
  syllables: string[];
}

export interface OtoEntry {
  fileName: string;
  alias: string;
  offsetMs: number;
  consonantMs: number;
  cutoffMs: number;
  preutteranceMs: number;
  overlapMs: number;
}

export interface SubbankSpec {
  color: string;
  prefix: string;
  suffix: string;
  toneRanges: string[];
}

export interface CharacterYamlManifest {
  name: string;
  singerType: 'utau';
  textFileEncoding: 'utf-8';
  author?: string;
  voice?: string;
  defaultPhonemizer?: string;
  subbanks: SubbankSpec[];
}

export interface ParsedRecordingListBundle {
  entries: ReclistEntry[];
  otoEntries: OtoEntry[];
  detectedEncoding: Exclude<SupportedEncoding, 'auto'>;
  rawOtoText?: string;
  rawDvcfgText?: string;
  readmeMarkdown?: string;
}
