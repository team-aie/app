import { DEFAULT_LOCALE, LOCAL_STORAGE_KEY_LOCALE, SUPPORTED_LOCALES } from '../../../common/env-and-consts';
import priorityLoadFromLocalStorage from '../../contexts/priority-local-storage-loader';
import { SupportedLocale } from '../../types';

const detectLanguage = (): SupportedLocale => {
  const languageInLocalStorage = priorityLoadFromLocalStorage(LOCAL_STORAGE_KEY_LOCALE, '');
  if (languageInLocalStorage && SUPPORTED_LOCALES.has(languageInLocalStorage)) {
    return languageInLocalStorage as SupportedLocale;
  } else {
    for (const languageInNavigator of navigator.languages) {
      if (SUPPORTED_LOCALES.has(languageInNavigator)) {
        return languageInNavigator as SupportedLocale;
      }
    }

    return DEFAULT_LOCALE;
  }
};

export default detectLanguage;
