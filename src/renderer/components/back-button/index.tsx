import React, { FC, MouseEventHandler } from 'react';
import { Button } from 'react-bootstrap';
import Image from 'react-bootstrap/Image';

import { Positional } from '../helper-components';

import backButton from './back-button.svg';

const BackButton: FC<{ onBack?: MouseEventHandler<HTMLElement> }> = ({ onBack }) => {
  return (
    <Positional position={'top-left'}>
      <Button onClick={onBack} variant={'outline-secondary'} className="highlightButton">
        <Image src={backButton} style={{ width: '1rem' }} />
      </Button>
    </Positional>
  );
};

export default BackButton;
