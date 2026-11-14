import i18next, { type i18n as I18nInstance, type Module } from 'i18next';
import type { LocaleCode } from '@shared/types';
import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  NAMESPACES,
  resources,
  SUPPORTED_LOCALES
} from './resources';

export * from './resources';

export function isSupportedLocale(value: unknown): value is LocaleCode {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Maps an arbitrary BCP-47 tag (e.g. `navigator.language` = `ja`, `zh-Hans-CN`,
 * `zh-TW`, `en-GB`) onto one of the three bundled locales.
 */
export function resolveLocale(tag: string | null | undefined): LocaleCode {
  if (!tag) {
    return DEFAULT_LOCALE;
  }
  if (isSupportedLocale(tag)) {
    return tag;
  }
  const lower = tag.toLowerCase();
  if (lower.startsWith('ja')) {
    return 'ja-JP';
  }
  if (lower.startsWith('zh')) {
    return 'zh-CN';
  }
  return DEFAULT_LOCALE;
}

export interface CreateI18nOptions {
  locale?: LocaleCode;
  /** Extra i18next modules, e.g. `initReactI18next` in the renderer. */
  modules?: Module[];
}

/**
 * Creates an isolated, synchronously-initialized i18next instance with all
 * statically bundled namespaces (no HTTP backend, works fully offline).
 */
export function createI18n(options: CreateI18nOptions = {}): I18nInstance {
  const instance = i18next.createInstance();
  for (const mod of options.modules ?? []) {
    instance.use(mod);
  }
  void instance.init({
    resources,
    lng: options.locale ?? DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: [...NAMESPACES],
    defaultNS: DEFAULT_NAMESPACE,
    load: 'currentOnly',
    initAsync: false,
    returnNull: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });
  return instance;
}
