import React, { FC } from 'react';

import { noOp } from '../../../common/env-and-consts';
import { LocaleContext } from '../../contexts';
import detectLanguage from '../../services/i18n/simple-language-detector';
import { SupportedLocale } from '../../types';
import StyleSwitcher from '../style-switcher';

const textTranslations = {
  [SupportedLocale.ZH_CN]: '载入中...',
  [SupportedLocale.EN_US]: 'Loading...',
  [SupportedLocale.JA_JP]: '読み込み中...',
};

/**
 * Shows a fallback view when the app is loading its translations.
 */
export const AppLoadFallback: FC = () => {
  const localeToLoad = detectLanguage();

  return (
    <LocaleContext.Provider value={{ locale: localeToLoad, setLocale: noOp() }}>
      <StyleSwitcher />
      {textTranslations[localeToLoad]}
    </LocaleContext.Provider>
  );
};
