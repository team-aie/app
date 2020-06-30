import log from 'electron-log';
import { PartialObserver, Subject, Subscription } from 'rxjs';

import { Closeable, IObservable } from '../../../types';
import { naiveEquals } from '../../../utils';
import { MediaDeviceInfoObservable } from '../media-device-info-observable';
import { CategorizedNormalizedMediaDeviceInfo, NormalizedMediaDeviceInfo } from '../media-device-info-observable/types';

import { AudioDeviceConfig, AudioDeviceId } from './types';

export class AudioDeviceConfigObservable implements Closeable, IObservable<AudioDeviceConfig> {
  private readonly audioDeviceConfigSubject: Subject<AudioDeviceConfig> = new Subject<AudioDeviceConfig>();
  private readonly mediaDeviceInfoSubscription: Subscription;
  private lastDeviceInfo: CategorizedNormalizedMediaDeviceInfo = {
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
  };
  private audioInputDeviceId: AudioDeviceId;
  private audioOutputDeviceId: AudioDeviceId;

  constructor(private readonly mediaDeviceInfoObservable: MediaDeviceInfoObservable) {
    this.mediaDeviceInfoSubscription = this.mediaDeviceInfoObservable.subscribe({
      next: this.onMediaDeviceInfoUpdate,
    });
  }

  private onMediaDeviceInfoUpdate = (deviceInfo: CategorizedNormalizedMediaDeviceInfo): void => {
    if (!naiveEquals(this.lastDeviceInfo, deviceInfo)) {
      this.setAudioInputOutputDeviceId(
        AudioDeviceConfigObservable.computeNextDeviceId(this.audioInputDeviceId, deviceInfo.audioInputs, true),
        AudioDeviceConfigObservable.computeNextDeviceId(this.audioOutputDeviceId, deviceInfo.audioOutputs, false),
      );
    }
  };

  static computeNextDeviceId(
    previousId: AudioDeviceId,
    allDevices: NormalizedMediaDeviceInfo[],
    input: boolean,
  ): AudioDeviceId {
    if (!allDevices.length) {
      return undefined;
    } else {
      const nextDevice: NormalizedMediaDeviceInfo | undefined =
        allDevices.find((x) => x.deviceId === previousId) ||
        allDevices.find((x) => (input ? x.isDefaultAudioInput : x.isDefaultAudioOutput));
      if (!nextDevice) {
        return undefined;
      } else {
        return nextDevice.deviceId;
      }
    }
  }

  setAudioInputDeviceId = (inputId: AudioDeviceId): void => {
    this.setAudioInputOutputDeviceId(inputId, this.audioOutputDeviceId);
  };

  setAudioOutputDeviceId = (outputId: AudioDeviceId): void => {
    this.setAudioInputOutputDeviceId(this.audioInputDeviceId, outputId);
  };

  setAudioInputOutputDeviceId = (inputId: AudioDeviceId, outputId: AudioDeviceId): void => {
    const nextConfig = {
      audioInputDeviceId: inputId,
      audioOutputDeviceId: outputId,
    };
    if (!naiveEquals(this.getLastAudioDeviceConfig(), nextConfig)) {
      log.debug('Audio device config updated');
      this.audioInputDeviceId = inputId;
      this.audioOutputDeviceId = outputId;
      this.audioDeviceConfigSubject.next(nextConfig);
    } else {
      log.warn('Audio device config is updated but the resulting config remains the same', nextConfig);
    }
  };

  private getLastAudioDeviceConfig = (): AudioDeviceConfig => {
    const { audioInputDeviceId, audioOutputDeviceId } = this;
    return { audioInputDeviceId, audioOutputDeviceId };
  };

  subscribe = (observer: PartialObserver<AudioDeviceConfig>): Subscription => {
    observer.next && observer.next(this.getLastAudioDeviceConfig());

    return this.audioDeviceConfigSubject.subscribe(observer);
  };

  close = (): void => {
    this.audioDeviceConfigSubject.complete();
    this.mediaDeviceInfoSubscription.unsubscribe();
  };
}
