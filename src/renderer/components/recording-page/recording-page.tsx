import log from 'electron-log';
import React, { FC, Fragment, MouseEventHandler } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import { useObservable } from 'react-use';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import useLocalStorage from 'react-use/lib/useLocalStorage';

import { noOp } from '../../../common/env-and-consts';
import mediaService from '../../services/media';
import { RecordingItem, ScaleKey, SupportedOctave } from '../../types';
import { getLSKey, join } from '../../utils';
import BackButton from '../back-button';

import { useRecordingPageLifeCycle, useWatchingProjectFileState } from './hooks';
import { RecordingControls } from './recording-controls';
import { RecordingItemIndicator } from './recording-item-indicator';
import { RecordingVisualizationProps } from './recording-visualization';

interface RecordingPageProps {
  onBack: MouseEventHandler<HTMLElement>;
  recordingItems: RecordingItem[];
  basePath: string;
  scaleKey: ScaleKey;
  octave: SupportedOctave;
  RecordingVisualization: React.FC<RecordingVisualizationProps>;
}

export const RecordingPage: FC<RecordingPageProps> = ({
  onBack,
  recordingItems,
  basePath,
  scaleKey,
  octave,
  RecordingVisualization,
}) => {
  const [index = 0, rawSetIndex] = useLocalStorage(getLSKey('RecordingPage', 'index'), 0);

  useEffectOnce(() => {
    mediaService.switchOnAudioInput();
  });

  const { updateProjectFileStatus, recordingState } = useWatchingProjectFileState(recordingItems, basePath);

  const [stateService, setIndex] = useRecordingPageLifeCycle(
    recordingItems,
    basePath,
    index,
    rawSetIndex,
    recordingState,
    updateProjectFileStatus,
    scaleKey,
    octave,
  );
  const state = useObservable(stateService.state$, 'idle');

  log.info(recordingState);
  return (
    <Fragment>
      <BackButton onBack={onBack} />
      <Container className={'h-100 d-flex flex-column justify-content-center'}>
        <Row>
          <RecordingItemIndicator recordingItems={recordingItems} currentIndex={index} />
        </Row>
        <Row className={'d-flex justify-content-center mt-3'}>
          <RecordingVisualization
            state={state}
            filePath={
              recordingState[recordingItems[index]?.fileSystemName]
                ? join(basePath, `${recordingItems[index].fileSystemName}.wav`)
                : undefined
            }
            basePath={basePath}
            recordingItemName={recordingItems[index]?.fileSystemName}
          />
        </Row>
        <RecordingControls
          toggleRecord={(): void => stateService.dispatch('toggle-recording')}
          togglePlay={(): void => stateService.dispatch('toggle-playing')}
          togglePlayScale={(): void => stateService.dispatch('toggle-playing-scale')}
          goToPrevious={(): void => (index > 0 ? setIndex(index - 1) : noOp()())}
          goToNext={(): void => (index < recordingItems.length - 1 ? setIndex(index + 1) : noOp()())}
          scaleKey={scaleKey}
          octave={octave}
        />
      </Container>
    </Fragment>
  );
};
