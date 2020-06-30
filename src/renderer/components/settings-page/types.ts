import { NormalizedMediaDeviceInfo } from '../../services/media/media-device-info-observable/types';

export interface KnownDevices {
  audioInputDevices: NormalizedMediaDeviceInfo[];
  audioOutputDevices: NormalizedMediaDeviceInfo[];
}

export interface DevicesInUse {
  audioInputDeviceId: string | undefined;
  audioOutputDeviceId: string | undefined;
}
