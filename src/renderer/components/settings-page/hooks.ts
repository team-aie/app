import { useObservable } from 'react-use';

import audioDeviceConfigService, { AudioDeviceId } from '../../services/media/audio-device-config-service';
import { NormalizedMediaDeviceInfo } from '../../services/media/media-device-info-service';
import { Consumer } from '../../types';

interface useAudioInputOutputDevicesReturnType {
  audioInputDevices: NormalizedMediaDeviceInfo[];
  audioOutputDevices: NormalizedMediaDeviceInfo[];
  audioInputDeviceId: AudioDeviceId | undefined;
  audioOutputDeviceId: AudioDeviceId | undefined;
  setAudioInputDeviceId: Consumer<AudioDeviceId>;
  setAudioOutputDeviceId: Consumer<AudioDeviceId>;
}

export const useAudioInputOutputDevices = (): useAudioInputOutputDevicesReturnType => {
  const audioInputDevices = useObservable(audioDeviceConfigService.audioInputDevices, []);
  const audioOutputDevices = useObservable(audioDeviceConfigService.audioOutputDevices, []);
  const audioInputDeviceId = useObservable(audioDeviceConfigService.audioInputDeviceId, undefined);
  const audioOutputDeviceId = useObservable(audioDeviceConfigService.audioOutputDeviceId, undefined);

  const { setAudioInputDeviceId, setAudioOutputDeviceId } = audioDeviceConfigService;
  return {
    audioInputDevices,
    audioOutputDevices,
    audioInputDeviceId,
    audioOutputDeviceId,
    setAudioInputDeviceId,
    setAudioOutputDeviceId,
  };
};
