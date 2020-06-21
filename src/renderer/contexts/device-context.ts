import React from 'react';

import { noOp } from '../env-and-consts';
import { Consumer } from '../types';
import { NormalizedMediaDeviceInfo } from '../utils';

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
  setDeviceStatus: noOp(),
});
