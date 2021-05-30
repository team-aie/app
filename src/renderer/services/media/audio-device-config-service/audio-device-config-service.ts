import log from 'electron-log';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, withLatestFrom } from 'rxjs/operators';

import { getLSCached, getLSKey, naiveEquals, naivePrettyPrint } from '../../../utils';
import { MediaDeviceInfoService, NormalizedMediaDeviceInfo } from '../media-device-info-service';

import { AudioDeviceId, RecordingFrequency, RecordingSampleSize } from './types';

const computeNextDeviceId = (
  allDevices: NormalizedMediaDeviceInfo[],
  preferredDeviceId: AudioDeviceId | undefined,
  isAudioInput: boolean,
): AudioDeviceId | undefined => {
  if (!allDevices.length) {
    return undefined;
  } else {
    const nextDevice: NormalizedMediaDeviceInfo | undefined =
      allDevices.find((x) => x.deviceId === preferredDeviceId) ||
      allDevices.find((x) => (isAudioInput ? x.isDefaultAudioInput : x.isDefaultAudioOutput));
    if (!nextDevice) {
      return undefined;
    } else {
      return nextDevice.deviceId;
    }
  }
};

export class AudioDeviceConfigService {
  private readonly allDeviceInfo = this.mediaDeviceInfoService.categorizedDeviceInfo;
  readonly audioInputDevices = this.allDeviceInfo.pipe(
    map((deviceInfo) => deviceInfo.audioInputs),
    distinctUntilChanged(naiveEquals),
    shareReplay(1),
  );
  readonly audioOutputDevices = this.allDeviceInfo.pipe(
    map((deviceInfo) => deviceInfo.audioOutputs),
    distinctUntilChanged(naiveEquals),
    shareReplay(1),
  );

  private readonly preferredInputDeviceId = new BehaviorSubject<AudioDeviceId | undefined>(undefined);
  private readonly preferredOutputDeviceId = new BehaviorSubject<AudioDeviceId | undefined>(undefined);

  readonly audioInputDeviceId = combineLatest(this.audioInputDevices, this.preferredInputDeviceId).pipe(
    map(([inputDevices, preferredInputId]) => computeNextDeviceId(inputDevices, preferredInputId, true)),
    distinctUntilChanged(),
    shareReplay(1),
  );
  readonly audioOutputDeviceId = combineLatest(this.audioOutputDevices, this.preferredOutputDeviceId).pipe(
    map(([outputDevices, preferredOutputId]) => computeNextDeviceId(outputDevices, preferredOutputId, false)),
    distinctUntilChanged(),
    shareReplay(1),
  );

  private readonly frequencySubject = new BehaviorSubject<RecordingFrequency>(
    getLSCached<RecordingFrequency>(getLSKey('AudioDeviceConfigService', 'frequency'), 44100),
  );
  private readonly sampleSizeSubject = new BehaviorSubject<RecordingSampleSize>(
    getLSCached<RecordingSampleSize>(getLSKey('AudioDeviceConfigService', 'sampleSize'), 16),
  );

  readonly frequency = this.frequencySubject.pipe(distinctUntilChanged(), shareReplay(1));
  readonly sampleSize = this.sampleSizeSubject.pipe(distinctUntilChanged(), shareReplay(1));

  constructor(private readonly mediaDeviceInfoService: MediaDeviceInfoService) {
    this.audioInputDeviceId
      .pipe(withLatestFrom(this.audioInputDevices))
      .subscribe(([deviceId, devices]) =>
        log.info(
          `Audio input device has been switched to ${naivePrettyPrint(devices.find((x) => x.deviceId === deviceId))}`,
        ),
      );

    this.audioOutputDeviceId
      .pipe(withLatestFrom(this.audioOutputDevices))
      .subscribe(([deviceId, devices]) =>
        log.info(
          `Audio output device has been switched to ${naivePrettyPrint(devices.find((x) => x.deviceId === deviceId))}`,
        ),
      );

    this.frequency.subscribe((nextFrequency) => {
      log.info(`Recording frequency has been changed to ${nextFrequency}`);
    });

    this.sampleSize.subscribe((nextSampleSize) => {
      log.info(`Recording sample size has been changed to ${nextSampleSize}`);
    });
  }

  setAudioInputDeviceId = (inputId: AudioDeviceId): void => {
    this.preferredInputDeviceId.next(inputId);
  };

  setAudioOutputDeviceId = (outputId: AudioDeviceId): void => {
    this.preferredOutputDeviceId.next(outputId);
  };

  setFrequency = (frequency: RecordingFrequency): void => {
    this.frequencySubject.next(frequency);
  };

  setSampleSize = (sampleSize: RecordingSampleSize): void => {
    this.sampleSizeSubject.next(sampleSize);
  };
}
