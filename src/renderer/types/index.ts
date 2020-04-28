export type PageState = 'create-project' | 'recording-studio' | 'start';

export interface RecordingItem {
  readonly displayText: string;
  readonly fileSystemName: string;
}

export interface RecordedVoiceItem extends RecordingItem {
  audioExists?: boolean;
}

export type Consumer<T> = (t: T) => void;

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
export const SUPPORTED_LOCALES: ReadonlySet<string> = new Set([
  SupportedLocale.ZH_CN,
  SupportedLocale.EN_US,
  SupportedLocale.JA_JP,
]);
