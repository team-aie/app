import React, { FC } from 'react';
import Container from 'react-bootstrap/esm/Container';
import { CSSTransition } from 'react-transition-group';
import { usePrevious } from 'react-use';

import { Consumer } from '../../types';

import { RecordingPageState } from '.';

const ListPreview: FC<{
  setRecordingSetState: Consumer<RecordingPageState>;
  prevState: RecordingPageState;
}> = ({ setRecordingSetState, prevState }) => {
  console.log(prevState);
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
          }}>
          ^^^^^^^
        </div>
        <button
          onClick={(): void => {
            setRecordingSetState('dvcfg');
          }}>
          {' '}
          Back{' '}
        </button>
        <div>List Preview</div>
        <button
          onClick={(): void => {
            setRecordingSetState('oto-ini');
          }}>
          Next{' '}
        </button>
      </Container>
    </CSSTransition>
  );
};

export default ListPreview;
