export type AudioDeviceId = string | undefined;

export interface AudioDeviceConfig {
  audioInputDeviceId: AudioDeviceId;
  audioOutputDeviceId: AudioDeviceId;
}
