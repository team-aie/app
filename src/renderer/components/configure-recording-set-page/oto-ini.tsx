import React, { FC } from 'react';
import { Button, Container } from 'react-bootstrap';
import { CSSTransition } from 'react-transition-group';

import { Consumer } from '../../types';

import { RecordingPageState } from '.';

export const OtoIni: FC<{
  setRecordingSetState: Consumer<RecordingPageState>;
  prevState: RecordingPageState;
}> = ({ setRecordingSetState, prevState }) => {
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
        <Button
          onClick={(): void => {
            setRecordingSetState('list-preview');
          }}>
          Back
        </Button>
        <div>Oto.ini</div>
        <Button
          onClick={(): void => {
            setRecordingSetState('dvcfg');
          }}>
          Next
        </Button>
      </Container>
    </CSSTransition>
  );
};
