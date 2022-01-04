import log from 'electron-log';
import { Observable, Subject, Subscription, combineLatest, skipUntil, takeUntil, tap, timer } from 'rxjs';
import { distinctUntilChanged, shareReplay, switchMap } from 'rxjs/operators';

import { Closeable, RecordingItem } from '../../types';
import { checkFileExistence, join, naiveEquals } from '../../utils';
import { FileMonitor } from '../../utils/file-monitor';

import { RecordingFileState } from './types';

export class ProjectFileStateService implements Closeable {
  private readonly fileMonitor = new FileMonitor(this.basePath);
  private readonly fileMonitorSubscription: Subscription;
  private readonly update$ = new Subject<void>();
  private readonly closed$ = new Subject<void>();
  private readonly recordingItems$ = new Subject<RecordingItem[]>();
  private readonly recordingState$ = combineLatest([this.recordingItems$, this.update$]).pipe(
    takeUntil(this.closed$),
    switchMap(([recordingItems]) => this.updateProjectFileStatus(recordingItems)),
    takeUntil(this.closed$),
    distinctUntilChanged(naiveEquals),
    tap(() => log.info('[ProjectFileStateService] Emitting new project file state')),
    shareReplay(1),
  );

  constructor(private readonly basePath: string) {
    log.info('[ProjectFileStateService] Using basePath', basePath);
    this.fileMonitor.watch(['add', 'unlink', 'change']);
    this.fileMonitorSubscription = this.fileMonitor
      .getSubject()
      .pipe(
        // FIXME: FileMonitor emits event when first started watching.
        skipUntil(timer(3000)),
      )
      .subscribe(([eventType, filePath]) => {
        log.info(`[ProjectFileStateService] Responding to ${eventType} event of ${filePath}, trigerring an update`);
        this.checkProjectFileStatus();
      });
  }

  get recordingFileState$(): Observable<Readonly<RecordingFileState>> {
    return this.recordingState$;
  }

  setRecordingItems = (recordingItems: RecordingItem[]): void => {
    this.recordingItems$.next(recordingItems);
  };

  checkProjectFileStatus = (): void => {
    log.info('[ProjectFileStateService] Triggering project file status update');
    this.update$.next();
  };

  updateProjectFileStatus = async (recordingItems: RecordingItem[]): Promise<RecordingFileState> => {
    log.info('[ProjectFileStateService] Update project file status with recordingItems:', recordingItems);

    const state: RecordingFileState = {};

    // FIXME: Break this down into several observables.
    await Promise.all(
      recordingItems.map(({ fileSystemName }) => {
        const filePath = join(this.basePath, `${fileSystemName}.wav`);
        return checkFileExistence(filePath)
          .then((result) => {
            state[fileSystemName] = result === 'file';
          })
          .catch(log.error);
      }),
    );
    return state;
  };

  close = (): void => {
    this.fileMonitorSubscription.unsubscribe();
    this.fileMonitor.closeAll();
    this.update$.complete();
    this.closed$.next();
    this.closed$.complete();
  };
}
