import React, { FC, MouseEventHandler } from 'react';
import Image from 'react-bootstrap/Image';

import backButton from './back-button.svg';

const ReturnButton: FC<{ onBack?: MouseEventHandler<HTMLElement> }> = ({ onBack }) => {
  return (
    <Image
      src={backButton}
      style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', width: '1rem' }}
      onClick={onBack}
    />
  );
};

export default ReturnButton;
