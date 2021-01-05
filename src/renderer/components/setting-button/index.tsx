import React, { FC, MouseEventHandler } from 'react';
import Button from 'react-bootstrap/Button';

import { Positional } from '../helper-components';

interface SettingButtonProps {
  text?: string;
  onClick: MouseEventHandler<HTMLElement>;
  disabled: boolean;
}

const SettingButton: FC<SettingButtonProps> = ({ text = 'Setting', onClick, disabled }) => {
  return (
    <Positional position={'top-right'}>
      <Button variant={'outline-secondary'} style={{ minWidth: '120px' }} onClick={onClick} disabled={disabled}>
        {text}
      </Button>
    </Positional>
  );
};

export default SettingButton;
