import React, { FC, MouseEventHandler } from 'react';
import Image from 'react-bootstrap/Image';

import { Positional } from '../helper-components';

import backButton from './back-button.svg';

const imgStyle = {
  width: '1rem',
  borderStyle: 'solid',
  borderColor: '#cb4335',
};

const BackButton: FC<{ onBack?: MouseEventHandler<HTMLElement> }> = ({ onBack }) => {
  return (
    <Positional position={'top-left'}>
      <Image src={backButton} style={imgStyle} onClick={onBack} />
    </Positional>
  );
};

export default BackButton;
