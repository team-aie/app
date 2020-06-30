export interface NormalizedMediaDeviceInfo {
  readonly deviceId: string;
  readonly groupId: string;
  readonly name: string;
  readonly isAudioInput: boolean;
  readonly isDefaultAudioInput: boolean;
  readonly isAudioOutput: boolean;
  readonly isDefaultAudioOutput: boolean;
  readonly isVideoInput: boolean;
  readonly isDefaultVideoInput: boolean;
}

type DeviceTypes = 'audioInputs' | 'audioOutputs' | 'videoInputs';

export type CategorizedNormalizedMediaDeviceInfo = {
  [k in DeviceTypes]: NormalizedMediaDeviceInfo[];
};
