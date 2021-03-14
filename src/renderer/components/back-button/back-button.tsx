import React, { FC, MouseEventHandler } from 'react';

import { Positional } from '../helper-components';
import ImageButton from '../image-button';

import backButton from './back-button.svg';

export const BackButton: FC<{ onBack?: MouseEventHandler<HTMLElement> }> = ({ onBack }) => {
  return (
    <Positional position={'top-left'}>
      <ImageButton onClick={onBack} src={backButton} width="1rem" />
    </Positional>
  );
};
