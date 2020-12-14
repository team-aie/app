import React, { FC } from 'react';
import { Container } from 'react-bootstrap';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';

import { RecordingPageState } from '.';

const OtoIni: FC<{
  setRecordingSetState: Consumer<RecordingPageState>;
  prevState: RecordingPageState;
  setPrevRecordingSetState: Consumer<RecordingPageState>;
}> = ({ setRecordingSetState, prevState, setPrevRecordingSetState }) => {
  const transitionProps = {
    in: true,
    appear: true,
    timeout: 3000,
    classNames: prevState == 'list-preview' ? 'slide-right' : 'slide-left',
  };
  return (
    <CSSTransition {...transitionProps}>
      <Container>
        <div onClick={() => setRecordingSetState('home')}>^^^^^^^</div>
        <button
          onClick={(): void => {
            setRecordingSetState('list-preview');
            setPrevRecordingSetState('oto-ini');
          }}>
          {' '}
          Back{' '}
        </button>{' '}
        <div>Oto.ini</div>
        <button
          onClick={(): void => {
            setRecordingSetState('dvcfg');
            setPrevRecordingSetState('oto-ini');
          }}>
          Next{' '}
        </button>{' '}
      </Container>
    </CSSTransition>
  );
};

export default OtoIni;
