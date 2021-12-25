import log from 'electron-log';
import { BehaviorSubject, Observable, Subject, concatMap, filter, of, switchMap, takeUntil } from 'rxjs';

import { noOp } from '../../../common/env-and-consts';
import { Closeable } from '../../types';

import { RecordingPageState } from './types';

type RecordingPageUserAction = 'navigate' | 'toggle-recording' | 'toggle-playing' | 'toggle-playing-scale';
type RecordingPageInternalAction =
  | 'start-recording'
  | 'end-recording'
  | 'start-playing'
  | 'end-playing'
  | 'start-playing-scale'
  | 'end-playing-scale';

interface RecordingPageTask {
  internalAction: RecordingPageInternalAction;
  nextTask?: RecordingPageTask;
}

export class RecordingPageStateService implements Closeable {
  private readonly closed$ = new Subject<void>();
  private readonly recordingPageState$ = new BehaviorSubject<RecordingPageState>('idle');

  private readonly pendingUserAction$ = new Subject<RecordingPageUserAction>();

  private readonly pendingInternalTask$ = this.pendingUserAction$.pipe(
    takeUntil(this.closed$),
    switchMap((action) => this.toInternalTask(action)),
    filter((task) => !!task),
    concatMap((x) => of(x)),
  );
  private readonly internalTasksSubscription = this.pendingInternalTask$.subscribe(
    (task) => task && this.processInternalTask(task),
  );
  private pendingInternalTaskCount = 0;

  get state(): RecordingPageState {
    return this.recordingPageState$.value;
  }
  get state$(): Observable<RecordingPageState> {
    return this.recordingPageState$;
  }

  private startRecording: () => void = noOp();
  private stopRecording: () => void = noOp();
  private startPlaying: () => void = noOp();
  private stopPlaying: () => void = noOp();
  private startPlayingScale: () => void = noOp();
  private stopPlayingScale: () => void = noOp();

  with = (
    startRecording: () => void,
    stopRecording: () => void,
    startPlaying: () => void,
    stopPlaying: () => void,
    startPlayingScale: () => void,
    stopPlayingScale: () => void,
  ): void => {
    this.startRecording = startRecording;
    this.stopRecording = stopRecording;
    this.startPlaying = startPlaying;
    this.stopPlaying = stopPlaying;
    this.startPlayingScale = startPlayingScale;
    this.stopPlayingScale = stopPlayingScale;
  };

  dispatch = (action: RecordingPageUserAction, callback?: () => unknown): void => {
    log.info(this, this.pendingInternalTaskCount, action, this.isProcessing());
    if (this.isProcessing()) {
      log.info('Currently processing tasks, will ignore this action', action);
      return;
    }
    this.pendingUserAction$.next(action);
    // TODO: This callback should execute after the task is processed.
    callback && callback();
  };

  private toInternalTask = async (action: RecordingPageUserAction): Promise<RecordingPageTask | undefined> => {
    log.info('toInternalTask', action);
    const { value: currentState } = this.recordingPageState$;
    if (currentState === 'idle') {
      if (action === 'navigate') {
        return;
      } else if (action === 'toggle-recording') {
        this.pendingInternalTaskCount++;
        return { internalAction: 'start-recording' };
      } else if (action === 'toggle-playing') {
        this.pendingInternalTaskCount++;
        return { internalAction: 'start-playing' };
      } else if (action === 'toggle-playing-scale') {
        this.pendingInternalTaskCount++;
        return { internalAction: 'start-playing-scale' };
      }
    } else if (currentState === 'recording') {
      if (action === 'navigate') {
        this.pendingInternalTaskCount++;
        return { internalAction: 'end-recording' };
      } else if (action === 'toggle-recording') {
        this.pendingInternalTaskCount++;
        return { internalAction: 'end-recording' };
      } else if (action === 'toggle-playing') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-recording',
          nextTask: { internalAction: 'start-playing' },
        };
      } else if (action === 'toggle-playing-scale') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-recording',
          nextTask: { internalAction: 'start-playing-scale' },
        };
      }
    } else if (currentState === 'playing') {
      if (action === 'navigate') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-playing',
        };
      } else if (action === 'toggle-recording') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-playing',
          nextTask: { internalAction: 'start-recording' },
        };
      } else if (action === 'toggle-playing') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-playing',
        };
      } else if (action === 'toggle-playing-scale') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-playing',
          nextTask: { internalAction: 'start-playing-scale' },
        };
      }
    } else if (currentState === 'playing-scale') {
      if (action === 'navigate') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-playing-scale',
        };
      } else if (action === 'toggle-recording') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-playing-scale',
          nextTask: { internalAction: 'start-recording' },
        };
      } else if (action === 'toggle-playing') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-playing-scale',
          nextTask: { internalAction: 'start-playing' },
        };
      } else if (action === 'toggle-playing-scale') {
        this.pendingInternalTaskCount++;
        return {
          internalAction: 'end-playing-scale',
        };
      }
    }
    throw new Error(`Unknown state ${currentState} or action ${action}`);
  };

  private processInternalTask = async (internalTask: RecordingPageTask): Promise<void> => {
    log.info('processInternalTask', internalTask);
    let nextState: RecordingPageState;
    do {
      log.info('processInternalTask current task', internalTask);
      nextState = await this.processInternalActionAndGetNextState(internalTask.internalAction);
      log.info('processInternalTask next state', nextState);
      // The while condition checks for nullness, so we will use non-null assertion for readability.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      internalTask = internalTask.nextTask!;
    } while (internalTask);
    this.recordingPageState$.next(nextState);
    this.pendingInternalTaskCount--;
  };

  private processInternalActionAndGetNextState = async (
    internalAction: RecordingPageInternalAction,
  ): Promise<RecordingPageState> => {
    log.info('processInternalActionAndGetNextState', internalAction);
    switch (internalAction) {
      case 'start-recording':
        this.startRecording();
        return 'recording';
      case 'end-recording':
        this.stopRecording();
        return 'idle';
      case 'start-playing':
        this.startPlaying();
        return 'playing';
      case 'end-playing':
        this.stopPlaying();
        return 'idle';
      case 'start-playing-scale':
        this.startPlayingScale();
        return 'playing';
      case 'end-playing-scale':
        this.stopPlayingScale();
        return 'idle';
    }
  };

  isProcessing = (): boolean => {
    return this.pendingInternalTaskCount !== 0;
  };

  close = (): void => {
    this.dispatch('navigate');
    this.internalTasksSubscription.unsubscribe();
    this.closed$.next();
    this.closed$.complete();
    this.pendingUserAction$.complete();
  };
}
