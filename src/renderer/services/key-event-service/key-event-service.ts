import log from 'electron-log';
import { Observable, Subject, delay, filter, fromEvent, merge, of, switchMap, take, takeUntil } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith, withLatestFrom } from 'rxjs/operators';

import { Closeable } from '../../types';
import { naiveEquals } from '../../utils';

export interface KeyHoldEvent {
  key: string;
  type: 'keyHoldDown' | 'keyHoldUp';
}

const HOLD_TIME_THRESHOLD_MS = 200;

export class KeyEventService implements Closeable {
  readonly rawKeyDownEvent$ = fromEvent<KeyboardEvent>(window, 'keydown');
  readonly rawKeyUpEvent$ = fromEvent<KeyboardEvent>(window, 'keyup');
  private readonly closed$ = new Subject<void>();

  getHoldEvents = (key: string): Observable<KeyHoldEvent> => {
    log.info('Creating Observables of key hold events for key', key);

    const keyDownEvent$ = this.rawKeyDownEvent$.pipe(
      filter((event) => event.key === key),
      map(({ key, type }) => ({ key, type })),
    );
    const keyUpEvent$ = this.rawKeyUpEvent$.pipe(
      filter((event) => event.key === key),
      map(({ key, type }) => ({ key, type })),
    );

    const lastHoldUpTimestamp$ = keyUpEvent$.pipe(
      map(() => new Date()),
      shareReplay(1),
      startWith(new Date()),
    );

    const keyHoldDownEvent$: Observable<KeyHoldEvent> = keyDownEvent$.pipe(
      withLatestFrom(lastHoldUpTimestamp$),
      distinctUntilChanged(([, t1], [, t2]) => {
        return naiveEquals(t1, t2);
      }),
      switchMap(([{ key }]) =>
        of<KeyHoldEvent>({ key, type: 'keyHoldDown' }).pipe(delay(HOLD_TIME_THRESHOLD_MS), takeUntil(keyUpEvent$)),
      ),
    );

    const keyHoldUpEvent$: Observable<KeyHoldEvent> = keyHoldDownEvent$.pipe(
      switchMap(() =>
        keyUpEvent$.pipe(
          take(1),
          map(({ key }): KeyHoldEvent => ({ key, type: 'keyHoldUp' })),
        ),
      ),
    );

    return merge(keyHoldDownEvent$, keyHoldUpEvent$).pipe(takeUntil(this.closed$));
  };

  close(): void | Promise<void> {
    this.closed$.next();
    this.closed$.complete();
  }
}
