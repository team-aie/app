import { useContext } from 'react';

import { DeviceContext } from '../../contexts';
import { Consumer } from '../../types';
import { NormalizedMediaDeviceInfo } from '../../utils';

export const useAudioInputOutputDevice = (): [
  NormalizedMediaDeviceInfo[],
  NormalizedMediaDeviceInfo[],
  string,
  string,
  Consumer<string>,
  Consumer<string>,
] => {
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

  return [
    audioInputDevices,
    audioOutputDevices,
    audioInputDeviceId,
    audioOutputDeviceId,
    setAudioInputDeviceId,
    setAudioOutputDeviceId,
  ];
};
