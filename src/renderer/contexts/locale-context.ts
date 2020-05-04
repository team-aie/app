import React from 'react';

import { Consumer, SupportedLocale } from '../types';

interface LocaleContextType {
  locale: SupportedLocale;
  setLocale: Consumer<SupportedLocale>;
}

/**
 * Currently, we will use Locale in place of "language", because Locale will include "region" and each region speaks a language.
 * However, there are users who use one language for display, but their number formats are from anothe region.
 * We will ignore those use cases until later time.
 */
export const LocaleContext = React.createContext<LocaleContextType>({
  locale: SupportedLocale.EN_US,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setLocale: (() => {}) as Consumer<SupportedLocale>,
});
