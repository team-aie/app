import { PartialObserver, Subscription } from 'rxjs';

export type PageState = 'welcome' | 'open-project' | 'configure-recording-set' | 'settings' | 'recording';

export type ScaleKey = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type SupportedOctave = 2 | 3 | 4 | 5;

export interface RecordingProject {
  readonly name: string;
  readonly rootPath: string;
  lastAccessTime?: Date;
}

export interface RecordingSet {
  name: string;
  scale: {
    key: ScaleKey;
    octave: SupportedOctave;
  };
  recordingList:
    | {
        type: 'built-in';
        name: string;
      }
    | {
        type: 'custom-file';
        filePath: string;
      };
  items?: RecordingItem[];
}

export interface RecordingItem {
  readonly displayText: string;
  readonly fileSystemName: string;
}

export interface RecordedVoiceItem extends RecordingItem {
  audioExists?: boolean;
}

export type Consumer<T> = (t: T) => void;
export type Func<T, R> = (t: T) => R;
export type UnaryOperator<T> = Func<T, T>;

export interface RecordingListParser {
  parse(content: string): Promise<RecordingItem[]>;
}

/**
 * Extending default {@link HTMLAudioElement} because it works in Chrome
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId}
 */
export interface ChromeHTMLAudioElement extends HTMLAudioElement {
  setSinkId(sinkId: string): Promise<void>;
}

export const enum SupportedLocale {
  ZH_CN = 'zh-CN',
  EN_US = 'en-US',
  JA_JP = 'ja-JP',
}

/**
 * https://stackoverflow.com/a/43001581
 */
export type Writeable<T> = { -readonly [P in keyof T]: T[P] };
/**
 * https://stackoverflow.com/a/43001581
 */
export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export interface Closeable {
  close(): void | Promise<void>;
}

export interface IObservable<T> {
  /**
   * Note: Must make sure to call onNext() with the last emitted value for each new subscriber
   * @param observer
   */
  subscribe(observer: PartialObserver<T>): Subscription;
}
