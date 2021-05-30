import { PartialObserver, Subscription } from 'rxjs';

import { BuiltInRecordingList } from '../components/configure-recording-set-page/types';

export type PageState = 'welcome' | 'open-project' | 'configure-recording-set' | 'settings' | 'recording';

export type ScaleKey = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type SupportedOctave = 2 | 3 | 4 | 5;

export interface RecordingProject {
  readonly name: string;
  readonly rootPath: string;
  lastAccessTime?: Date;
}

export type RecordingList =
  | {
      type: 'built-in';
      name: BuiltInRecordingList;
    }
  | {
      type: 'custom-file';
      filePath: string;
    };

export interface RecordingSet {
  name: string;
  scale: {
    key: ScaleKey;
    octave: SupportedOctave;
  };
  recordingList: RecordingList;
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

export const enum SupportedTheme {
  LIGHT = 'light',
  DARK = 'dark',
}

/**
 * Allows fields to be writable on an interface with "readonly" keyword.
 *
 * https://stackoverflow.com/a/43001581
 */
export type Writeable<T> = { -readonly [P in keyof T]: T[P] };
/**
 * Similar to {@link Writable}, but suppresses "readonly" deeply into the object.
 *
 * https://stackoverflow.com/a/43001581
 */
export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

/**
 * Creates a tuple without typescript complaints.
 *
 * See also: https://stackoverflow.com/a/52445008.
 */
export const tuple = <T extends unknown[]>(...args: T): T => args;

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

/**
 * A basic type trying to encompass all the types that can be stringified with `JSON.stringify()`.
 */
export type Serializable = string | number | boolean | Array<unknown> | Record<string | number | symbol, unknown>;
