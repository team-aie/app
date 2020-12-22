import React from 'react';

import { noOp } from '../env-and-consts';
import { Consumer, SupportedTheme } from '../types';

interface ThemeContextType {
  theme: SupportedTheme;
  setTheme: Consumer<SupportedTheme>;
}

/**
 * Currently, we will use Locale in place of "language", because Locale will include "region" and each region speaks a language.
 * However, there are users who use one language for display, but their number formats are from anothe region.
 * We will ignore those use cases until later time.
 */
export const ThemeContext = React.createContext<ThemeContextType>({
  theme: SupportedTheme.LIGHT,
  setTheme: noOp(),
});
