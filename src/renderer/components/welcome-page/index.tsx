import React, { FC, MouseEventHandler } from 'react';
import { Button } from 'react-bootstrap';
import Container from 'react-bootstrap/Container';
import Image from 'react-bootstrap/Image';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';

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
        <Button onClick={onNext} className="img-button">
          <Image src={startButton} style={{ width: '10rem' }} />
        </Button>
      </Row>
      <Row>
        <span>{t('Link Start')}</span>
      </Row>
    </Container>
  );
};

export default WelcomePage;
