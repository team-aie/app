export type State = 'idle' | 'recording' | 'playing' | 'playing-scale';

export type RecordingFileState = { [k: string]: boolean };
