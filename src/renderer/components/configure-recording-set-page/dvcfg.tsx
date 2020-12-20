import React, { FC } from 'react';
import { Button } from 'react-bootstrap';
import Container from 'react-bootstrap/esm/Container';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';

import { RecordingPageState } from '.';

export const Dvcfg: FC<{
  setRecordingSetState: Consumer<RecordingPageState>;
  prevState: RecordingPageState;
}> = ({ setRecordingSetState, prevState }) => {
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
        <Button
          onClick={(): void => {
            setRecordingSetState('oto-ini');
          }}>
          Back
        </Button>
        <div>.dvcfg</div>
        <Button
          onClick={(): void => {
            setRecordingSetState('list-preview');
          }}>
          Next
        </Button>
      </Container>
    </CSSTransition>
  );
};
