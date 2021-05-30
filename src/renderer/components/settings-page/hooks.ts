import { useState } from 'react';
import { Subscription, combineLatest } from 'rxjs';

import audioDeviceConfigService from '../../services/media/audio-device-config-service';
import mediaDeviceInfoService, { NormalizedMediaDeviceInfo } from '../../services/media/media-device-info-service';
import { Consumer } from '../../types';
import { useUnsubscribeOnUnmount } from '../../utils';
import { useInitializerRef } from '../../utils/use-initializer-ref';

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
    mediaDeviceInfoService.categorizedDeviceInfo$.subscribe({
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
    combineLatest([
      audioDeviceConfigService.audioInputDeviceId$,
      audioDeviceConfigService.audioOutputDeviceId$,
    ]).subscribe({
      next: ([audioInputDeviceId, audioOutputDeviceId]) => {
        setDevicesInUse({
          audioInputDeviceId,
          audioOutputDeviceId,
        });
      },
    }),
  );
  useUnsubscribeOnUnmount(audioDeviceConfigSubscriptionRef);

  const { setAudioInputDeviceId } = audioDeviceConfigService;
  const { setAudioOutputDeviceId } = audioDeviceConfigService;

  return [
    audioInputDevices,
    audioOutputDevices,
    audioInputDeviceId,
    audioOutputDeviceId,
    setAudioInputDeviceId,
    setAudioOutputDeviceId,
  ];
};
