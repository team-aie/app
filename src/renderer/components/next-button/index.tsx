import React, { FC, MouseEventHandler } from 'react';
import Button from 'react-bootstrap/Button';

import { Positional } from '../helper-components';

interface NextButtonProps {
  text?: string;
  onClick: MouseEventHandler<HTMLElement>;
  disabled: boolean;
}

const NextButton: FC<NextButtonProps> = ({ text = 'Next', onClick, disabled }) => {
  return (
    <Positional position={'bottom-right'}>
      <Button variant={'outline-secondary'} style={{ minWidth: '120px' }} onClick={onClick} disabled={disabled}>
        {text}
      </Button>
    </Positional>
  );
};

export default NextButton;
