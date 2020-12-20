import React, { FC } from 'react';
import { Button } from 'react-bootstrap';
import Container from 'react-bootstrap/esm/Container';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';

import { RecordingPageState } from '.';

export const ListPreview: FC<{
  setRecordingSetState: Consumer<RecordingPageState>;
  prevState: RecordingPageState;
}> = ({ setRecordingSetState, prevState }) => {
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
        <Button
          onClick={(): void => {
            setRecordingSetState('dvcfg');
          }}>
          Back
        </Button>
        <div>List Preview</div>
        <Button
          onClick={(): void => {
            setRecordingSetState('oto-ini');
          }}>
          Next
        </Button>
      </Container>
    </CSSTransition>
  );
};
