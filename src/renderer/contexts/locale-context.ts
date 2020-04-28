import React from 'react';

import { SupportedLocale } from '../types';

/**
 * Currently, we will use Locale in place of "language", because Locale will include "region" and each region speaks a language.
 * However, there are users who use one language for display, but their number formats are from anothe region.
 * We will ignore those use cases until later time.
 */
export const LocaleContext = React.createContext({
  locale: SupportedLocale.EN_US,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setLocale: (() => {}) as (locale: SupportedLocale) => void,
});
