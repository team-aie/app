import { useState } from 'react';
import { Subscription } from 'rxjs';

import audioDeviceConfigObservable from '../../services/media/audio-device-config-observable';
import mediaDeviceInfoObservable from '../../services/media/media-device-info-observable';
import { NormalizedMediaDeviceInfo } from '../../services/media/media-device-info-observable/types';
import { Consumer } from '../../types';
import { useUnsubscribeOnUnmount } from '../../utils';
import { useInitializerRef } from '../../utils/useInitializerRef';

import { DevicesInUse, KnownDevices } from './types';

export const useAudioInputOutputDevices = (): [
  NormalizedMediaDeviceInfo[],
  NormalizedMediaDeviceInfo[],
  string | undefined,
  string | undefined,
  Consumer<string>,
  Consumer<string>,
] => {
  const [{ audioInputDevices, audioOutputDevices }, setDevices] = useState<KnownDevices>({
    audioInputDevices: [],
    audioOutputDevices: [],
  });

  const [{ audioInputDeviceId, audioOutputDeviceId }, setDevicesInUse] = useState<DevicesInUse>({
    audioInputDeviceId: undefined,
    audioOutputDeviceId: undefined,
  });

  const mediaDeviceInfoSubscriptionRef = useInitializerRef<Subscription>(() =>
    mediaDeviceInfoObservable.subscribe({
      next: ({ audioInputs: audioInputDevices, audioOutputs: audioOutputDevices }) => {
        setDevices({
          audioInputDevices,
          audioOutputDevices,
        });
      },
    }),
  );
  useUnsubscribeOnUnmount(mediaDeviceInfoSubscriptionRef);

  const audioDeviceConfigSubscriptionRef = useInitializerRef<Subscription>(() =>
    audioDeviceConfigObservable.subscribe({
      next: ({ audioInputDeviceId, audioOutputDeviceId }) => {
        setDevicesInUse({
          audioInputDeviceId,
          audioOutputDeviceId,
        });
      },
    }),
  );
  useUnsubscribeOnUnmount(audioDeviceConfigSubscriptionRef);

  const { setAudioInputDeviceId } = audioDeviceConfigObservable;
  const { setAudioOutputDeviceId } = audioDeviceConfigObservable;

  return [
    audioInputDevices,
    audioOutputDevices,
    audioInputDeviceId,
    audioOutputDeviceId,
    setAudioInputDeviceId,
    setAudioOutputDeviceId,
  ];
};
