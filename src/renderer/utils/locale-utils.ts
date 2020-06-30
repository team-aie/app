import log from 'electron-log';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Consumer, SupportedLocale } from '../types';

export const useLocale = (): [SupportedLocale, Consumer<SupportedLocale>] => {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState(i18n.language as SupportedLocale);

  useEffect(() => {
    document.documentElement.lang = locale.substr(0, 2).toLocaleLowerCase();
    document.documentElement.dir = i18n.dir(locale);

    if (locale !== i18n.language) {
      i18n.changeLanguage(locale).catch(log.error);
    }
  }, [locale, i18n]);

  useEffect(() => {
    const updateLocaleHandler = (lng: SupportedLocale): void => {
      setLocale(lng);
    };
    i18n.on('languageChanged', updateLocaleHandler);

    return (): void => i18n.off('languageChanged', updateLocaleHandler);
  }, [i18n]);

  return [locale, setLocale];
};
