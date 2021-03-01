export type BuiltInRecordingList =
  | 'デルタ式英語リストver5 (Delta English Ver. 5)'
  | 'Z式CVVC-Normal (Z Chinese CVVC - Normal)';

/**
 * Represents the page states controlled by configure-recording-set.
 *
 * 'external' represents pages external from this system. It's used to determine which transition should be used for the entering home page.
 */
export type RecordingPageState = 'home' | 'external' | 'metadata';
export type MetadataState = 'list-preview' | 'oto-ini' | 'dvcfg';
