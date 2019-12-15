import { Locale } from './i18n';

export type PageState = 'create-project' | 'recording-studio' | 'start';

export interface RecordingItem {
  readonly displayText: string;
  readonly fileSystemName: string;
}

export interface RecordedVoiceItem extends RecordingItem {
  audioExists?: boolean;
}

export type Consumer<T> = (t: T) => void;

export interface Environment {
  locale: Locale;
}

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
