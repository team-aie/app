import React, { FC } from 'react';
import Container from 'react-bootstrap/esm/Container';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';

import { RecordingPageState } from '.';

const Dvcfg: FC<{
  setRecordingSetState: Consumer<RecordingPageState>;
  prevState: RecordingPageState;
  setPrevRecordingSetState: Consumer<RecordingPageState>;
}> = ({ setRecordingSetState, prevState, setPrevRecordingSetState }) => {
  const transitionProps = {
    in: true,
    appear: true,
    timeout: 3000,
    classNames: prevState == 'oto-ini' ? 'slide-right' : 'slide-left',
  };
  return (
    <CSSTransition {...transitionProps}>
      <Container>
        <div onClick={() => setRecordingSetState('home')}>^^^^^^^</div>
        <button
          onClick={(): void => {
            setRecordingSetState('oto-ini');
            setPrevRecordingSetState('dvcfg');
          }}>
          {' '}
          Back{' '}
        </button>{' '}
        <div>.dvcfg</div>
        <button
          onClick={(): void => {
            setRecordingSetState('list-preview');
            setPrevRecordingSetState('dvcfg');
          }}>
          Next{' '}
        </button>{' '}
      </Container>
    </CSSTransition>
  );
};

export default Dvcfg;
