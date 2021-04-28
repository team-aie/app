/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { FC } from 'react';

import { RecordingVisualizationProps } from './recording-visualization';

export const RecordingVisualizationStub: FC<RecordingVisualizationProps> = ({
  prevState,
  state,
  filePath,
  basePath,
  recordingItemName,
}) => {
  return (
    <div>
      <h1> Stub of Recording Vis</h1>
    </div>
  );
};
