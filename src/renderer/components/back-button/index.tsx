import React, { FC, MouseEventHandler } from 'react';
import Image from 'react-bootstrap/Image';

import { Positional } from '../helper-components';

import backButton from './back-button.svg';

// const buttonStyle = {
//   width: '1rem',
// };

// const highlightButtonStyle = {
//   borderStyle: 'solid',
//   borderColor: '#cb4335',
// }

// const selectedButtonStyle = {
//   borderStyle: 'solid',
//   borderColor: 'blue',
// }

const BackButton: FC<{ onBack?: MouseEventHandler<HTMLElement> }> = ({ onBack }) => {
  return (
    <Positional position={'top-left'}>
      <Image src={backButton} style={{ width: '1rem' }} onClick={onBack} className="highlightButton" />
    </Positional>
  );
};

export default BackButton;
