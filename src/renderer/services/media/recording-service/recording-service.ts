import log from 'electron-log';
import { Subject, exhaustMap, takeUntil, tap } from 'rxjs';

import { Closeable, RecordingItem } from '../../../types';
import { MediaService } from '../types';

import { CompletedRecordingJob, PendingRecordingJob } from './types';

export class RecordingService implements Closeable {
  private readonly closed$ = new Subject<void>();
  private readonly pendingJob$ = new Subject<PendingRecordingJob>();
  readonly completedJob$ = this.pendingJob$.pipe(
    takeUntil(this.closed$),
    tap((job) => log.info(`[RecordingService] Recording job received:`, job)),
    // This will prevent recording jobs to queue up or be processed concurrently, while it is currently recording a job.
    exhaustMap((job) => {
      log.info(`[RecordingService] Currently recording and processing:`, job);
      return this.processRecordingJob(job);
    }),
    tap((job) => log.info(`[RecordingService] Recording job recorded and processed:`, job)),
    takeUntil(this.closed$),
  );

  constructor(private readonly mediaService: MediaService) {}

  startRecording = async (recordingItem: RecordingItem): Promise<PendingRecordingJob> => {
    const job: PendingRecordingJob = {
      recordingItem,
    };
    this.pendingJob$.next(job);
    return job;
  };

  stopRecording = (): void => {
    this.mediaService.stopRecording();
  };

  private processRecordingJob = async (recordingJob: PendingRecordingJob): Promise<CompletedRecordingJob> => {
    try {
      const recordedBlob = await this.mediaService.startRecording();
      return { ...recordingJob, recordedBlob };
    } catch (e) {
      return {
        ...recordingJob,
        error: new Error(`[RecordingService] Failed to process recording job ${recordingJob}, error: ${e}`),
      };
    }
  };

  close = (): void => {
    this.stopRecording();
    this.closed$.next();
    this.closed$.complete();
  };
}
