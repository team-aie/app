import React, { FC } from 'react';
import Container from 'react-bootstrap/esm/Container';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';

import { RecordingPageState } from '.';

const ListPreview: FC<{
  setRecordingSetState: Consumer<RecordingPageState>;
  prevState: RecordingPageState;
  setPrevRecordingSetState: Consumer<RecordingPageState>;
}> = ({ setRecordingSetState, prevState, setPrevRecordingSetState }) => {
  const transitionProps = {
    in: true,
    appear: true,
    timeout: 3000,
    classNames: prevState == 'oto-ini' ? 'slide-left' : prevState == 'dvcfg' ? 'slide-right' : 'slide-down',
  };
  return (
    <CSSTransition {...transitionProps}>
      <Container>
        <div
          onClick={(): void => {
            setRecordingSetState('home');
            setPrevRecordingSetState('list-preview');
          }}>
          ^^^^^^^
        </div>
        <button
          onClick={(): void => {
            setRecordingSetState('dvcfg');
            setPrevRecordingSetState('list-preview');
          }}>
          {' '}
          Back{' '}
        </button>
        <div>List Preview</div>
        <button
          onClick={(): void => {
            setRecordingSetState('oto-ini');
            setPrevRecordingSetState('list-preview');
          }}>
          Next{' '}
        </button>
      </Container>
    </CSSTransition>
  );
};

export default ListPreview;
