import log from 'electron-log';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { distinctUntilChanged, shareReplay, startWith, switchMap } from 'rxjs/operators';

import { acquireAudioInputStream, naiveEquals } from '../../../utils';
import { AudioDeviceConfigService } from '../audio-device-config-service';

export class AudioInputStreamService {
  private readonly audioInputDeviceId$ = this.audioDeviceConfigService.audioInputDeviceId$;
  private readonly frequency$ = this.audioDeviceConfigService.sampleRate$;
  private readonly sampleSize$ = this.audioDeviceConfigService.sampleSize$;

  private readonly isOn$ = new BehaviorSubject(false);

  readonly audioInputStream$: Observable<MediaStream | undefined> = combineLatest([
    this.isOn$,
    this.audioInputDeviceId$,
    this.frequency$,
    this.sampleSize$,
  ]).pipe(
    distinctUntilChanged(naiveEquals),
    switchMap(async ([isOn, inputDeviceId, frequency, sampleSize]) => {
      if (!isOn) {
        return undefined;
      } else if (!inputDeviceId) {
        log.warn(`Requested to start but input stream but an input device ID is not configured.`);
        return undefined;
      } else {
        log.debug('Audio input device ID updated, attempting stream creation', inputDeviceId, frequency, sampleSize);
        try {
          return await acquireAudioInputStream(inputDeviceId, frequency, sampleSize);
        } catch (e) {
          log.error('Failed to create audio input stream', e, inputDeviceId, frequency, sampleSize);
          return undefined;
        }
      }
    }),
    startWith(undefined),
    shareReplay(1),
  );

  constructor(private readonly audioDeviceConfigService: AudioDeviceConfigService) {}

  getIsOn = (): boolean => {
    return this.isOn$.value;
  };

  switchOn = (): void => {
    this.isOn$.next(true);
  };

  switchOff = (): void => {
    this.isOn$.next(false);
  };
}
