import React, { FC, MouseEventHandler } from 'react';
import Button from 'react-bootstrap/Button';

interface NextButtonProps {
  text?: string;
  onClick: MouseEventHandler<HTMLElement>;
  disabled: boolean;
}

const NextButton: FC<NextButtonProps> = ({ text = 'Next', onClick, disabled }) => {
  return (
    <Button
      variant={'outline-secondary'}
      style={{ position: 'absolute', bottom: '30px', right: '30px', minWidth: '120px' }}
      onClick={onClick}
      disabled={disabled}>
      {text}
    </Button>
  );
};

export default NextButton;
