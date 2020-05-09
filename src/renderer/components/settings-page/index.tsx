import React, { FC, Fragment, MouseEventHandler, useContext } from 'react';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';

import { DeviceContext } from '../../contexts';
import { naiveSerialize } from '../../utils';
import BackButton from '../back-button';
import NextButton from '../next-button';

export const SettingsPage: FC<{
  onNext: MouseEventHandler<HTMLElement>;
  onBack: MouseEventHandler<HTMLElement>;
}> = ({ onNext, onBack }) => {
  const {
    deviceStatus: { audioInputDevices, audioOutputDevices, audioInputDeviceId, audioOutputDeviceId },
    setDeviceStatus,
  } = useContext(DeviceContext);

  const setAudioInputDeviceId = (deviceId: string): void => {
    setDeviceStatus({
      audioInputDevices,
      audioOutputDevices,
      audioInputDeviceId: deviceId,
      audioOutputDeviceId,
    });
  };

  const setAudioOutputDeviceId = (deviceId: string): void => {
    setDeviceStatus({
      audioInputDevices,
      audioOutputDevices,
      audioInputDeviceId,
      audioOutputDeviceId: deviceId,
    });
  };

  return (
    <Fragment>
      <BackButton onBack={onBack} />
      <Container>
        <Row style={{ paddingTop: '6rem' }}>
          <Col xs={'auto'} sm={3} md={3} lg={3} xl={3}>
            Input Device
          </Col>
          <Col xs={'auto'} sm={7} md={7} lg={7} xl={7}>
            <Form className={'w-100'}>
              <Form.Group>
                <Form.Control
                  as={'select'}
                  className={'border-top-0 border-right-0 border-left-0 rounded-0'}
                  value={audioInputDeviceId}
                  onChange={(e): void => setAudioInputDeviceId(e.target.value)}>
                  {!!audioInputDeviceId || <option value={''} />}
                  {audioInputDevices.map((inputDevice) => (
                    <option key={naiveSerialize(inputDevice)} value={inputDevice.deviceId}>
                      {`${inputDevice.name}${inputDevice.isDefaultAudioOutput ? ' (Default)' : ''}`}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Form>
          </Col>
        </Row>
        <Row>
          <Col xs={'auto'} sm={3} md={3} lg={3} xl={3}>
            Output Device
          </Col>
          <Col xs={'auto'} sm={7} md={7} lg={7} xl={7}>
            <Form className={'w-100'}>
              <Form.Group>
                <Form.Control
                  as={'select'}
                  className={'border-top-0 border-right-0 border-left-0 rounded-0'}
                  value={audioOutputDeviceId}
                  onChange={(e): void => setAudioOutputDeviceId(e.target.value)}>
                  {!!audioOutputDeviceId || <option value={''} />}
                  {audioOutputDevices.map((outputDevice) => (
                    <option key={naiveSerialize(outputDevice)} value={outputDevice.deviceId}>
                      {`${outputDevice.name}${outputDevice.isDefaultAudioOutput ? ' (Default)' : ''}`}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Form>
          </Col>
        </Row>
      </Container>
      <NextButton text={'Confirm'} onClick={onNext} disabled={false} />
    </Fragment>
  );
};
