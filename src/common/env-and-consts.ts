import { RecordingFrequency, RecordingSampleSize } from '../renderer/services/media/audio-device-config-service';
import { PageState, ScaleKey, SupportedLocale, SupportedOctave, SupportedTheme } from '../renderer/types';

export const isDevelopment = process.env.NODE_ENV !== 'production';

export const LOCAL_STORAGE_KEY_LOCALE = 'locale';
export const DEFAULT_LOCALE = SupportedLocale.EN_US;
export const DEFAULT_THEME = SupportedTheme.LIGHT;
export const KEY_SEPARATOR = '$';
export const PAGE_STATES_IN_ORDER: PageState[] = [
  'welcome',
  'open-project',
  'configure-recording-set',
  'recording',
  'settings',
];
export const SUPPORTED_LOCALES: ReadonlySet<string> = new Set([
  SupportedLocale.ZH_CN,
  SupportedLocale.EN_US,
  SupportedLocale.JA_JP,
]);
export const SUPPORTED_FREQUENCIES: ReadonlySet<RecordingFrequency> = new Set([44100, 48000]);
export const SUPPORTED_SAMPLE_SIZES: ReadonlySet<RecordingSampleSize> = new Set([16, 24, 32]);

export const SUPPORTED_THEMES: ReadonlySet<string> = new Set([SupportedTheme.DARK, SupportedTheme.LIGHT]);

export const SCALE_KEYS_IN_ORDER: ScaleKey[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SUPPORTED_OCTAVES_IN_ORDER: SupportedOctave[] = [2, 3, 4, 5];
export const PROJECT_CONFIG_FILENAME = 'aie.config.json';

export const ACQUIRE_PERMISSION_RETRIES = 3;
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noOp = (): (() => void) => (): void => {};
