import log from 'electron-log';
import { Observable, from, fromEvent } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith, switchMap } from 'rxjs/operators';

import { Writeable } from '../../../types';
import { naiveDeepCopy } from '../../../utils';

import { CategorizedNormalizedMediaDeviceInfo, NormalizedMediaDeviceInfo } from './types';

const normalizeMediaDevices = (devices: MediaDeviceInfo[]): NormalizedMediaDeviceInfo[] => {
  devices = naiveDeepCopy(devices);

  const defaults: Writeable<MediaDeviceInfo>[] = devices.filter((device) => device.deviceId === 'default');
  // Remove "Default" prefix to get original device name
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
};

const categorizeNormalizedMediaDeviceInfo = (
  devices: NormalizedMediaDeviceInfo[],
): CategorizedNormalizedMediaDeviceInfo => {
  const result: CategorizedNormalizedMediaDeviceInfo = {
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

/**
 * Provides media device updates, at creation and when the the device changes. Media devices include audio input
 * devices, audio output devices, and video input devices.
 */
export class MediaDeviceInfoService {
  private readonly deviceChanges$ = fromEvent(this.mediaDevices, 'devicechange');

  /**
   * Emits post-processed media device information as {@link CategorizedNormalizedMediaDeviceInfo} when current info is
   * distinct from the last. Replays 1 past info on subscribe.
   */
  readonly categorizedDeviceInfo$: Observable<CategorizedNormalizedMediaDeviceInfo> = this.deviceChanges$.pipe(
    // Since we don't care about the actual Event values, map to undefined to make `startWith(value)` simpler to write.
    map(() => undefined),
    // Triggers a device list fetch on creation, before `devicechange` events ever fire.
    startWith(undefined),
    switchMap(() =>
      // Do all the processing here to fully leverage the cancelling feature of `switchMap()`.
      from(this.mediaDevices.enumerateDevices()).pipe(
        map(normalizeMediaDevices),
        map(categorizeNormalizedMediaDeviceInfo),
      ),
    ),
    distinctUntilChanged(),
    shareReplay(1),
  );

  constructor(private readonly mediaDevices: MediaDevices) {
    this.categorizedDeviceInfo$.subscribe((deviceInfo) => {
      log.debug('Media device info updated', deviceInfo);
    });
  }
}
