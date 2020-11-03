import React, { FC, MouseEventHandler } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';

import ImageButton from '../image-button';

import startButton from './start-button.svg';

const WelcomePage: FC<{ onNext: MouseEventHandler<HTMLElement> }> = ({ onNext }) => {
  const { t } = useTranslation();
  return (
    <Container style={{ height: '100%' }} className={'d-flex flex-column justify-content-center align-items-center'}>
      <Row>
        <h2>{t('Hello!')}</h2>
      </Row>
      <Row>
        <h2>{t('Here is aie')}</h2>
      </Row>
      <Row>
        <h2>{t('A fantastic list recording application')}</h2>
      </Row>
      <Row style={{ marginTop: '100px' }}>
        <ImageButton onClick={onNext} img={startButton}></ImageButton>
      </Row>
      <Row>
        <span>{t('Link Start')}</span>
      </Row>
    </Container>
  );
};

export default WelcomePage;
