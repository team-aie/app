import React, { FC } from 'react';
import Col from 'react-bootstrap/Col';

import { RecordingItem } from '../../types';

interface RecordingPageProps {
  recordingItems: RecordingItem[];
  currentIndex: number;
}

export const RecordingItemIndicator: FC<RecordingPageProps> = ({ recordingItems, currentIndex }) => {
  return (
    <Col className={'d-flex flex-column align-items-center'}>
      <h4 className={'place-held'}>
        {recordingItems[currentIndex - 1] && recordingItems[currentIndex - 1].displayText}
      </h4>
      <h2 className={'place-held'}>{recordingItems[currentIndex] && recordingItems[currentIndex].displayText}</h2>
      <h4 className={'place-held'}>
        {recordingItems[currentIndex + 1] && recordingItems[currentIndex + 1].displayText}
      </h4>
    </Col>
  );
};
