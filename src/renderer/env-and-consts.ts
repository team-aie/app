import { SupportedLocale } from './types';

export const isDevelopment = process.env.NODE_ENV !== 'production';

export const LOCAL_STORAGE_KEY_LOCALE = 'locale';
export const DEFAULT_LOCALE = SupportedLocale.EN_US;
export const LOCALE_TO_FONT_FAMILY = {
  [SupportedLocale.EN_US]: 'Source Han Sans',
  [SupportedLocale.JA_JP]: 'Source Han Sans',
  [SupportedLocale.ZH_CN]: 'Source Han Sans SC',
};
