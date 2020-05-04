import { PageState, ScaleKey, SupportedLocale, SupportedOctave } from './types';

export const isDevelopment = process.env.NODE_ENV !== 'production';

export const LOCAL_STORAGE_KEY_LOCALE = 'locale';
export const DEFAULT_LOCALE = SupportedLocale.EN_US;
export const KEY_SEPARATOR = '$';
export const PAGE_STATES_IN_ORDER: PageState[] = [
  'welcome',
  'open-project',
  'configure-recording-set',
  'recording-studio',
];
export const SUPPORTED_LOCALES: ReadonlySet<string> = new Set([
  SupportedLocale.ZH_CN,
  SupportedLocale.EN_US,
  SupportedLocale.JA_JP,
]);
export const SCALE_KEYS_IN_ORDER: ScaleKey[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SUPPORTED_OCTAVES_IN_ORDER: SupportedOctave[] = [2, 3, 4, 5];
export const PROJECT_CONFIG_FILENAME = 'aie.config.json';
