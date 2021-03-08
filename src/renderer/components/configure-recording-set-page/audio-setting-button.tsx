import React, { FC, MouseEventHandler, useContext } from 'react';

import { ThemeContext } from '../../contexts';
import { SupportedTheme } from '../../types';
import ImageButton from '../image-button';

import buttonWhenDark from './audio-setting-button-dark.svg';
import buttonWhenLight from './audio-setting-button-light.svg';

interface AudioSettingButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>;
}

export const AudioSettingButton: FC<AudioSettingButtonProps> = ({ onClick }) => {
  const { theme } = useContext(ThemeContext);

  return (
    <ImageButton
      src={theme === SupportedTheme.LIGHT ? buttonWhenLight : buttonWhenDark}
      onClick={onClick}
      width="2em"
    />
  );
};
