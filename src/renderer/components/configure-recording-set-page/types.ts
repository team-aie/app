export type BuiltInRecordingList =
  | 'デルタ式英語リストver5 (Delta English Ver. 5)'
  | 'DV JPN List by Alex'
  | '扩展CVVC 8lite (Extended CVVC 8lite)'
  | 'Z式CVVC-Normal (Z Chinese CVVC - Normal)';

/**
 * Represents the page states controlled by configure-recording-set.
 *
 * `external` represents pages external from this system. It's used to determine which transition should be used for
 * the entering home page.
 */
export type ConfigureRecordingSetPageState = 'home' | 'external' | 'metadata';
export type MetadataState = 'list-preview' | 'oto-ini' | 'dvcfg';
