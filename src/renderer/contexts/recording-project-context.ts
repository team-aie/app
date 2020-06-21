import React from 'react';

import { noOp } from '../env-and-consts';
import { Consumer, RecordingProject } from '../types';

interface RecordingProjectContextType {
  readonly recordingProject?: RecordingProject;
  readonly setRecordingProject: Consumer<RecordingProject>;
}

export const RecordingProjectContext = React.createContext<RecordingProjectContextType>({
  setRecordingProject: noOp(),
});
