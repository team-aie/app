import log from 'electron-log';
import React, { FC, Fragment, MouseEventHandler, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import useLocalStorage from 'react-use/lib/useLocalStorage';
import usePrevious from 'react-use/lib/usePrevious';

import { noOp } from '../../../common/env-and-consts';
import mediaService from '../../services/media';
import { RecordingItem, ScaleKey, SupportedOctave } from '../../types';
import { getLSKey, join } from '../../utils';
import BackButton from '../back-button';

import { useHotKeyHandlers, useRecordingPageLifeCycle, useWatchingProjectFileState } from './hooks';
import { RecordingControls } from './recording-controls';
import { RecordingItemIndicator } from './recording-item-indicator';
import { RecordingVisualization } from './recording-visualization';
import { State } from './types';

interface RecordingPageProps {
  onBack: MouseEventHandler<HTMLElement>;
  recordingItems: RecordingItem[];
  basePath: string;
  scaleKey: ScaleKey;
  octave: SupportedOctave;
}

export const RecordingPage: FC<RecordingPageProps> = ({ onBack, recordingItems, basePath, scaleKey, octave }) => {
  const [state, setState] = useState<State>('idle');
  const prevState = usePrevious(state);
  log.info(`prevState`, prevState, `state`, state);
  const [index = 0, setIndex] = useLocalStorage(getLSKey('RecordingPage', 'index'), 0);

  useEffectOnce(() => {
    mediaService.switchOnAudioInput();
  });

  const { updateProjectFileStatus, recordingState } = useWatchingProjectFileState(recordingItems, basePath);

  useRecordingPageLifeCycle(
    prevState,
    state,
    setState,
    recordingItems,
    basePath,
    index,
    recordingState,
    updateProjectFileStatus,
    scaleKey,
    octave,
  );
  useHotKeyHandlers(state, setState);

  log.info(recordingState);
  return (
    <Fragment>
      {/* <Image
        style={{ width: '2rem' }}
        src={settingButton}
        onClick={(): void => {
          for (let i = 0; i < reservedStates.length; i++) {
            stored.push(localStorage.getItem(reservedStates[i]));
          }
          localStorage.clear();
          for (let i = 0; i < reservedStates.length; i++) {
            localStorage.setItem(reservedStates[i], stored[i]);
          }
        }}></Image> */}
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
          />
        </Row>
        <RecordingControls
          toggleRecord={(): void => (state === 'recording' ? setState('idle') : setState('recording'))}
          togglePlay={(): void => (state === 'playing' ? setState('idle') : setState('playing'))}
          togglePlayScale={(): void => (state === 'playing-scale' ? setState('idle') : setState('playing-scale'))}
          goToPrevious={(): void => (index > 0 ? setIndex(index - 1) : noOp()())}
          goToNext={(): void => (index < recordingItems.length - 1 ? setIndex(index + 1) : noOp()())}
          scaleKey={scaleKey}
          octave={octave}
        />
      </Container>
    </Fragment>
  );
};
