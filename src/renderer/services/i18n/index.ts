import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { LOCAL_STORAGE_KEY_LOCALE, isDevelopment } from '../../env-and-consts';

import WebpackImportBackend from './webpack-import-backend';

i18n
  .use(WebpackImportBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en-US',
    debug: true,
    // We don't use separators yet, so just need something that should not common appear in strings.
    keySeparator: '$',
    ...(isDevelopment ? { saveMissing: true, saveMissingTo: 'all' } : {}),
    backend: {
      saveMissingAllHierarchy: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCAL_STORAGE_KEY_LOCALE,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });
