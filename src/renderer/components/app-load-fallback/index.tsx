import React, { FC } from 'react';

import { LocaleContext } from '../../contexts';
import detectLanguage from '../../services/i18n/simple-language-detector';
import { SupportedLocale } from '../../types';
import StyleSwitcher from '../style-switcher';

const textTranslations = {
  [SupportedLocale.ZH_CN]: '载入中...',
  [SupportedLocale.EN_US]: 'Loading...',
  [SupportedLocale.JA_JP]: '読み込み中...',
};

const AppLoadFallback: FC = () => {
  const localeToLoad = detectLanguage();

  return (
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    <LocaleContext.Provider value={{ locale: localeToLoad, setLocale: (): void => {} }}>
      <StyleSwitcher />
      {textTranslations[localeToLoad]}
    </LocaleContext.Provider>
  );
};

export default AppLoadFallback;
