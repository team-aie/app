import React from 'react';

import { noOp } from '../../common/env-and-consts';
import { Consumer, SupportedTheme } from '../types';

interface ThemeContextType {
  theme: SupportedTheme;
  setTheme: Consumer<SupportedTheme>;
}

/**
 * Currently, we will use Theme to support theme mode switching.
 * It contains light and dark style and the initial theme is set as light
 */
export const ThemeContext = React.createContext<ThemeContextType>({
  theme: SupportedTheme.LIGHT,
  setTheme: noOp(),
});
