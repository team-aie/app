import log from 'electron-log';
import { PartialObserver, Subject, Subscription } from 'rxjs';

import { Closeable, IObservable } from '../../../types';
import { acquireAudioInputStream } from '../../../utils';
import { AudioDeviceConfigObservable } from '../audio-device-config-observable';
import { AudioDeviceConfig, AudioDeviceId } from '../audio-device-config-observable/types';

export class AudioInputStreamObservable implements Closeable, IObservable<MediaStream | undefined> {
  private readonly audioInputStreamSubject = new Subject<MediaStream | undefined>();
  private readonly audioDeviceConfigSubscription: Subscription;
  private lastAudioInputDeviceId: AudioDeviceId;
  private cancelLastMicrophoneAccessAcquisition?: () => void;
  private isOn = false;
  private lastAudioInputStream?: MediaStream;
  private lastAudioDeviceConfig?: AudioDeviceConfig;

  constructor(private readonly audioDeviceConfigObservable: AudioDeviceConfigObservable) {
    this.audioDeviceConfigSubscription = this.audioDeviceConfigObservable.subscribe({
      next: this.onAudioDeviceConfigUpdate,
    });
  }

  private onAudioDeviceConfigUpdate = (audioDeviceConfig: AudioDeviceConfig) => {
    const { audioInputDeviceId } = audioDeviceConfig;
    if (this.isOn) {
      if (this.lastAudioInputDeviceId !== audioInputDeviceId) {
        log.debug('Audio input device ID updated, attempting stream creation', audioInputDeviceId, audioDeviceConfig);
        if (audioInputDeviceId) {
          this.onNewAudioInputDeviceSelection(audioInputDeviceId, audioDeviceConfig);
        }
      } else {
        log.warn('Audio config updated but audio input device ID is the same', audioInputDeviceId, audioDeviceConfig);
      }
    }
    this.lastAudioDeviceConfig = audioDeviceConfig;
  };

  private onNewAudioInputDeviceSelection = (audioInputDeviceId: string, audioDeviceConfig: AudioDeviceConfig): void => {
    let isCancelled = false;
    this.cancelLastMicrophoneAccessAcquisition && this.cancelLastMicrophoneAccessAcquisition();
    const cancelThisAttempt = () => {
      isCancelled = true;
      if (this.cancelLastMicrophoneAccessAcquisition === cancelThisAttempt) {
        this.cancelLastMicrophoneAccessAcquisition = undefined;
      }
    };
    acquireAudioInputStream(audioInputDeviceId)
      .then((stream) => {
        if (!isCancelled) {
          log.debug('Audio input stream created', audioInputDeviceId, audioDeviceConfig);
          this.audioInputStreamSubject.next(stream);
          this.lastAudioInputStream = stream;
          this.lastAudioInputDeviceId = audioInputDeviceId;
        }
      })
      .catch((e) => {
        log.error('Failed to create audio input stream', e, audioInputDeviceId, audioDeviceConfig);
        this.audioInputStreamSubject.error(e);
      })
      .finally(cancelThisAttempt);
    this.cancelLastMicrophoneAccessAcquisition = cancelThisAttempt;
  };

  getIsOn = (): boolean => {
    return this.isOn;
  };

  switchOn = (): void => {
    if (!this.isOn) {
      this.isOn = true;
      this.lastAudioDeviceConfig && this.onAudioDeviceConfigUpdate(this.lastAudioDeviceConfig);
    }
  };

  switchOff = (): void => {
    this.isOn = false;
    this.audioInputStreamSubject.next(undefined);
    this.lastAudioInputStream = undefined;
    this.cancelLastMicrophoneAccessAcquisition && this.cancelLastMicrophoneAccessAcquisition();
  };

  close = (): void => {
    this.audioInputStreamSubject.complete();
    this.audioDeviceConfigSubscription.unsubscribe();
  };

  subscribe = (observer: PartialObserver<MediaStream | undefined>): Subscription => {
    if (this.getIsOn()) {
      observer.next && observer.next(this.lastAudioInputStream);
    }
    return this.audioInputStreamSubject.subscribe(observer);
  };
}
