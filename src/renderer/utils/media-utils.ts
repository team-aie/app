import { remote } from 'electron';
import log from 'electron-log';
import { useContext, useEffect } from 'react';
import { useMediaDevices } from 'react-use';

import { DeviceContext, DeviceStatus } from '../contexts';
import { ACQUIRE_PERMISSION_RETRIES } from '../env-and-consts';
import { Consumer, Writeable } from '../types';

import { naiveSerialize } from './index';

export const acquireAudioInputStream = async (deviceId: string): Promise<MediaStream> => {
  const constraint: MediaStreamConstraints = {
    audio: {
      deviceId,
      sampleRate: 44100,
      channelCount: 1,
    },
  };

  for (let attemptCount = 0; attemptCount < ACQUIRE_PERMISSION_RETRIES; attemptCount++) {
    try {
      // askForMediaAccess() is only for macOS
      const microphoneApproved =
        (remote.systemPreferences.askForMediaAccess &&
          (await remote.systemPreferences.askForMediaAccess('microphone'))) ||
        true;
      if (microphoneApproved) {
        return await navigator.mediaDevices.getUserMedia(constraint);
      } else {
        // noinspection ExceptionCaughtLocallyJS as this was intentional
        throw new Error('Entire app was not given microphone access');
      }
    } catch (e) {
      log.warn('Microphone access failed to acquire', e);
      alert(
        `We need to record audio in order to proceed${
          attemptCount < ACQUIRE_PERMISSION_RETRIES - 1 ? ", let's try again." : '!'
        }`,
      );
    }
  }

  throw new Error('Failed to obtain microphone stream');
};

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

const useNormalizedMediaDevices = (): NormalizedMediaDeviceInfo[] => {
  const { devices } = useMediaDevices() as { devices?: MediaDeviceInfo[] };
  if (!devices) {
    return [];
  } else {
    const defaults: Writeable<MediaDeviceInfo>[] = devices.filter((device) => device.deviceId === 'default');
    defaults.forEach((device) => (device.label = device.label.replace('Default - ', '')));
    const allDevices = devices.filter((device) => device.deviceId !== 'default');
    const deviceMap = new Map<string, Writeable<NormalizedMediaDeviceInfo>>();
    allDevices.forEach(({ deviceId, groupId, kind, label }) => {
      const deviceInfo: Writeable<NormalizedMediaDeviceInfo> = deviceMap.has(deviceId)
        ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          deviceMap.get(deviceId)!
        : {
            deviceId,
            groupId,
            name: label,
            isAudioInput: false,
            isDefaultAudioInput: false,
            isAudioOutput: false,
            isDefaultAudioOutput: false,
            isVideoInput: false,
            isDefaultVideoInput: false,
          };
      deviceInfo.isAudioInput = deviceInfo.isAudioInput || kind === 'audioinput';
      deviceInfo.isAudioOutput = deviceInfo.isAudioOutput || kind === 'audiooutput';
      deviceInfo.isVideoInput = deviceInfo.isVideoInput || kind === 'videoinput';
      deviceMap.set(deviceId, deviceInfo);
    });

    [...deviceMap.values()].forEach((deviceInfo) => {
      const { groupId, name } = deviceInfo;
      const matchingDefault = defaults.filter((device) => device.label === name);
      if (!matchingDefault.length) {
        return;
      }
      const defaultMatches = ['audioinput', 'audiooutput', 'videoinput'].map((kindKeyword) =>
        matchingDefault
          .filter((defaultDevice) => defaultDevice.kind === kindKeyword)
          .filter((defaultDevice) => defaultDevice.groupId === groupId && defaultDevice.label === name),
      );
      deviceInfo.isDefaultAudioInput = !!defaultMatches[0];
      deviceInfo.isDefaultAudioOutput = !!defaultMatches[1];
      deviceInfo.isDefaultVideoInput = !!defaultMatches[2];
    });

    return [...deviceMap.values()];
  }
};

type DeviceTypes = 'audioInputs' | 'audioOutputs' | 'videoInputs';

const useNormalizedMediaDeviceCategories = (): {
  [k in DeviceTypes]: NormalizedMediaDeviceInfo[];
} => {
  const devices = useNormalizedMediaDevices();
  const result: { [k in DeviceTypes]: NormalizedMediaDeviceInfo[] } = {
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
  };

  devices.forEach((device) => {
    if (device.isAudioInput) {
      result.audioInputs.push(device);
    }
    if (device.isAudioOutput) {
      result.audioOutputs.push(device);
    }
    if (device.isVideoInput) {
      result.videoInputs.push(device);
    }
  });

  return result;
};

export const useMonitoringDevices = (): [DeviceStatus, Consumer<DeviceStatus>] => {
  const { audioInputs, audioOutputs } = useNormalizedMediaDeviceCategories();
  const { deviceStatus, setDeviceStatus } = useContext(DeviceContext);
  const { audioInputDevices, audioOutputDevices, audioInputDeviceId, audioOutputDeviceId } = deviceStatus;

  useEffect(() => {
    if (
      naiveSerialize(audioInputs) !== naiveSerialize(audioInputDevices) ||
      naiveSerialize(audioOutputs) !== naiveSerialize(audioOutputDevices)
    ) {
      setDeviceStatus({
        audioInputDevices: audioInputs,
        audioOutputDevices: audioOutputs,
        audioInputDeviceId,
        audioOutputDeviceId,
      });
    }
  }, [
    audioInputDeviceId,
    audioInputDevices,
    audioInputs,
    audioOutputDeviceId,
    audioOutputDevices,
    audioOutputs,
    setDeviceStatus,
  ]);

  return [deviceStatus, setDeviceStatus];
};
