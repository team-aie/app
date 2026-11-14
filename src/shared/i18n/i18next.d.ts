import 'i18next';
import type { LocaleResourceBundle } from './resources';

/**
 * Strict-typed i18n: every `t('ns:key')` / `useTranslation('ns')` call is
 * checked against the canonical en-US key tree at compile time.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: LocaleResourceBundle;
    returnNull: false;
  }
}
