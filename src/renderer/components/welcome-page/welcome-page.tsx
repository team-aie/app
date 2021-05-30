import React, { FC, MouseEventHandler } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';

import { useAbnormalShutdownResumeSessionCheck } from '../../utils/localstorage-clear';
import { Positional } from '../helper-components';
import ImageButton from '../image-button';
import ThemeSwitch from '../theme-switch';

import startButton from './start-button-img.svg';

export const WelcomePage: FC<{ onResumeStatus: () => void; onNext: MouseEventHandler<HTMLElement> }> = ({
  onResumeStatus,
  onNext,
}) => {
  const { t } = useTranslation();
  useAbnormalShutdownResumeSessionCheck(onResumeStatus);
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
        <ImageButton onClick={onNext} src={startButton} width="10rem" />
      </Row>
      <Row>
        <span>{t('Link Start')}</span>
      </Row>
      <Positional position={'top-right'}>
        <ThemeSwitch />
      </Positional>
    </Container>
  );
};
