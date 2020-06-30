import log from 'electron-log';
import { PartialObserver, Subject, Subscription, fromEvent } from 'rxjs';

import { Closeable, IObservable, Writeable } from '../../../types';
import { naiveDeepCopy, naiveEquals } from '../../../utils';

import { CategorizedNormalizedMediaDeviceInfo, NormalizedMediaDeviceInfo } from './types';

/**
 * Provides an observable interface for media device updates
 */
export class MediaDeviceInfoObservable implements Closeable, IObservable<CategorizedNormalizedMediaDeviceInfo> {
  private readonly deviceInfoSubject: Subject<CategorizedNormalizedMediaDeviceInfo>;
  private readonly eventSubscription: Subscription;
  private lastCategorizedDeviceInfo?: CategorizedNormalizedMediaDeviceInfo;

  constructor(private readonly mediaDevices: MediaDevices) {
    this.deviceInfoSubject = new Subject<CategorizedNormalizedMediaDeviceInfo>();
    this.eventSubscription = fromEvent(this.mediaDevices, 'devicechange').subscribe(this.updateMediaDevices);
    // Trigger initial update on start-up
    this.updateMediaDevices().catch(log.error);
  }

  updateMediaDevices = async (): Promise<void> => {
    const devices = await this.mediaDevices.enumerateDevices();
    const normalizedDevices = MediaDeviceInfoObservable.normalizeMediaDevices(devices);
    const categorizedDeviceInfo = MediaDeviceInfoObservable.categorizeNormalizedMediaDeviceInfo(normalizedDevices);
    if (!naiveEquals(categorizedDeviceInfo, this.lastCategorizedDeviceInfo)) {
      this.deviceInfoSubject.next(categorizedDeviceInfo);
      this.lastCategorizedDeviceInfo = categorizedDeviceInfo;
      log.debug('Device info updated', categorizedDeviceInfo);
    } else {
      log.warn('Devices are updated but the resulting info remains the same', categorizedDeviceInfo);
    }
  };

  subscribe = (observer: PartialObserver<CategorizedNormalizedMediaDeviceInfo>): Subscription => {
    observer.next && this.lastCategorizedDeviceInfo && observer.next(this.lastCategorizedDeviceInfo);
    return this.deviceInfoSubject.subscribe(observer);
  };

  close = (): void => {
    this.deviceInfoSubject.complete();
    this.eventSubscription.unsubscribe();
  };

  // Visible for testing
  static normalizeMediaDevices(devices: MediaDeviceInfo[]): NormalizedMediaDeviceInfo[] {
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
  }

  // Visible for testing
  static categorizeNormalizedMediaDeviceInfo(
    devices: NormalizedMediaDeviceInfo[],
  ): CategorizedNormalizedMediaDeviceInfo {
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
  }
}
