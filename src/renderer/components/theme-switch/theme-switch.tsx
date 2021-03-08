import React, { FC, useContext } from 'react';

import { ThemeContext } from '../../contexts';
import { SupportedTheme } from '../../types';
import ImageButton from '../image-button';

import toDarkModeButton from './to-dark-mode.svg';
import toLightModeButton from './to-light-mode.svg';

export const ThemeSwitch: FC = () => {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <ImageButton
      src={theme === SupportedTheme.LIGHT ? toDarkModeButton : toLightModeButton}
      onClick={() => setTheme(theme === SupportedTheme.LIGHT ? SupportedTheme.DARK : SupportedTheme.LIGHT)}
      width="2em"
    />
  );
};
