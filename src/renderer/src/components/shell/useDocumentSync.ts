import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocaleCode, ThemeMode } from '@shared/types';
import { useAppStore } from '@renderer/store/useAppStore';

export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(DARK_QUERY).matches;
}

/** Resolves `system` against the OS color scheme and follows live changes. */
export function useResolvedTheme(theme: ThemeMode): ResolvedTheme {
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);
  if (theme === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return theme;
}

export function applyDocumentAttributes(locale: LocaleCode, theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dataset['theme'] = theme;
  root.style.colorScheme = theme;
}

/**
 * Keeps `<html lang={locale} data-theme={resolvedTheme}>` and the i18next
 * language in sync with the persisted app settings.
 */
export function useDocumentSync(): ResolvedTheme {
  const locale = useAppStore((state) => state.settings.locale);
  const theme = useAppStore((state) => state.settings.theme);
  const resolvedTheme = useResolvedTheme(theme);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  useEffect(() => {
    applyDocumentAttributes(locale, resolvedTheme);
  }, [locale, resolvedTheme]);

  return resolvedTheme;
}
