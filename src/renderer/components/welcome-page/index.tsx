import React, { FC, MouseEventHandler } from 'react';
import Container from 'react-bootstrap/Container';
import Image from 'react-bootstrap/Image';
import Row from 'react-bootstrap/Row';

import startButton from './start-button.svg';

const WelcomePage: FC<{ onNext: MouseEventHandler<HTMLElement> }> = ({ onNext }) => {
  return (
    <Container style={{ height: '100%' }} className={'d-flex flex-column justify-content-center align-items-center'}>
      <Row>
        <h2>Hello!</h2>
      </Row>
      <Row>
        <h2>Here is aie</h2>
      </Row>
      <Row>
        <h2>A fantastic list recording application</h2>
      </Row>
      <Row style={{ marginTop: '100px' }}>
        <Image onClick={onNext} src={startButton} thumbnail style={{ width: '10rem' }} />
      </Row>
      <Row>
        <span>Link Start</span>
      </Row>
    </Container>
  );
};

export default WelcomePage;
