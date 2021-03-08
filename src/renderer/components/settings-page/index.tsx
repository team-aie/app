import log from 'electron-log';
import React, { FC, Fragment, MouseEventHandler, useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import { useTranslation } from 'react-i18next';
import useEffectOnce from 'react-use/lib/useEffectOnce';

import mediaService from '../../services/media';
import { naiveSerialize } from '../../utils';
import BackButton from '../back-button';
import NextButton from '../next-button';
import { Select } from '../select';

import { useAudioInputOutputDevices } from './hooks';

export const SettingsPage: FC<{
  onSettingsButtonClick: MouseEventHandler<HTMLElement>;
}> = ({ onSettingsButtonClick }) => {
  const { t } = useTranslation();
  const [
    audioInputDevices,
    audioOutputDevices,
    audioInputDeviceId,
    audioOutputDeviceId,
    setAudioInputDeviceId,
    setAudioOutputDeviceId,
  ] = useAudioInputOutputDevices();
  const [muted, setMuted] = useState(true);
  useEffect((): void => {
    if (muted) {
      mediaService.stopPlaying().catch(log.error);
    } else {
      mediaService.createNewAudioGraph();
      mediaService.playAudioInput().catch(log.error);
    }
  }, [muted]);

  useEffectOnce(() => {
    mediaService.switchOnAudioInput();
  });

  return (
    <Fragment>
      <BackButton onBack={onSettingsButtonClick} />
      <Container>
        <Row style={{ paddingTop: '6rem' }}>
          <Col xs={'auto'} sm={3} md={3} lg={3} xl={3}>
            {t('Input Device')}
          </Col>
          <Col xs={'auto'} sm={7} md={7} lg={7} xl={7}>
            <Select
              className={'w-100'}
              value={audioInputDeviceId || ''}
              onChange={(e): void => setAudioInputDeviceId(e.target.value)}>
              {!!audioInputDeviceId || <option value={''} />}
              {audioInputDevices.map((inputDevice) => (
                <option key={naiveSerialize(inputDevice)} value={inputDevice.deviceId}>
                  {`${inputDevice.name}${inputDevice.isDefaultAudioOutput ? ` ${t('(Default)')}` : ''}`}
                </option>
              ))}
            </Select>
          </Col>
        </Row>
        <Row>
          <Col xs={'auto'} sm={3} md={3} lg={3} xl={3}>
            {t('Output Device')}
          </Col>
          <Col xs={'auto'} sm={7} md={7} lg={7} xl={7}>
            <Select
              className={'w-100'}
              value={audioOutputDeviceId || ''}
              onChange={(e): void => setAudioOutputDeviceId(e.target.value)}>
              {!!audioOutputDeviceId || <option value={''} />}
              {audioOutputDevices.map((outputDevice) => (
                <option key={naiveSerialize(outputDevice)} value={outputDevice.deviceId}>
                  {`${outputDevice.name}${outputDevice.isDefaultAudioOutput ? ` ${t('(Default)')}` : ''}`}
                </option>
              ))}
            </Select>
          </Col>
        </Row>
        <Row>
          <Button
            onClick={(): void => setMuted(!muted)}
            style={{ width: '8rem' }}
            variant={'outline-primary'}
            active={!muted}>
            {muted ? t('Test Audio') : t('Mute')}
          </Button>
        </Row>
      </Container>
      <NextButton text={t('OK')} onClick={onSettingsButtonClick} disabled={false} />
    </Fragment>
  );
};
