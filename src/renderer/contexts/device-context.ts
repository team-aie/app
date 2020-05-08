import React from 'react';

import { Consumer } from '../types';
import { NormalizedMediaDeviceInfo } from '../utils/media-utils';

export interface DeviceStatus {
  audioInputDevices: NormalizedMediaDeviceInfo[];
  audioOutputDevices: NormalizedMediaDeviceInfo[];
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
}

interface DeviceContextType {
  deviceStatus: DeviceStatus;
  setDeviceStatus: Consumer<DeviceStatus>;
}

export const DeviceContext = React.createContext<DeviceContextType>({
  deviceStatus: {
    audioInputDevices: [],
    audioOutputDevices: [],
    audioInputDeviceId: '',
    audioOutputDeviceId: '',
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setDeviceStatus: (() => {}) as Consumer<DeviceStatus>,
});
