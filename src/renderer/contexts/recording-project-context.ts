import React from 'react';

import { Consumer, RecordingProject } from '../types';

interface RecordingProjectContextType {
  readonly recordingProject?: RecordingProject;
  readonly setRecordingProject: Consumer<RecordingProject>;
}

export const RecordingProjectContext = React.createContext<RecordingProjectContextType>({
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setRecordingProject: (() => {}) as Consumer<RecordingProject>,
});
