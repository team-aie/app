import log from 'electron-log';
import { Subject, concatMap, filter, takeUntil } from 'rxjs';

import { Closeable, RecordingItem } from '../../../types';
import { naiveSerialize } from '../../../utils';
import { MediaService } from '../types';

export interface RecordingJob {
  recordingItem: RecordingItem;
  recordedBlob?: Blob;
}

export class RecordingService implements Closeable {
  private readonly closed$ = new Subject<void>();
  private readonly recordingJob$ = new Subject<RecordingJob>();
  readonly recordedJob$ = this.recordingJob$.pipe(
    takeUntil(this.closed$),
    concatMap(async (job) => {
      try {
        return await this.processRecordingJob(job);
      } catch (e) {
        log.error('Recording failed for:', naiveSerialize(job), 'error:', e);
        return job;
      }
    }),
    takeUntil(this.closed$),
    filter((job) => !!job.recordedBlob),
  );

  constructor(private readonly mediaService: MediaService) {}

  startRecording = async (recordingItem: RecordingItem): Promise<RecordingJob> => {
    const job: RecordingJob = {
      recordingItem,
    };
    this.recordingJob$.next(job);
    return job;
  };

  stopRecording = (): void => {
    this.mediaService.stopRecording();
  };

  private processRecordingJob = async (recordingJob: RecordingJob): Promise<RecordingJob> => {
    const recordedBlob = await this.mediaService.startRecording();
    return { ...recordingJob, recordedBlob };
  };

  close = (): void => {
    this.stopRecording();
    this.closed$.next();
    this.closed$.complete();
  };
}
