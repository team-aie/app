import { RecordingItem } from '../../../types';

export interface PendingRecordingJob {
  recordingItem: RecordingItem;
}

export interface RecordedRecordingJob {
  recordingItem: RecordingItem;
  recordedBlob: Blob;
}

export interface ErroredRecordingJob {
  recordingItem: RecordingItem;
  error: Error;
}

export type CompletedRecordingJob = RecordedRecordingJob | ErroredRecordingJob;
