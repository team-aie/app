import toWav from 'audiobuffer-to-wav';
import log from 'electron-log';
import React, { FC, Fragment, MouseEventHandler, useContext, useEffect, useRef, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import useLocalStorage from 'react-use/lib/useLocalStorage';
import usePrevious from 'react-use/lib/usePrevious';
import useUpdate from 'react-use/lib/useUpdate';

import { AudioInputStreamContext, DeviceContext } from '../../contexts';
import { noOp } from '../../env-and-consts';
import {
  addGlobalKeyDownHandler,
  addGlobalKeyUpHandler,
  removeGlobalKeyDownHandler,
  removeGlobalKeyUpHandler,
} from '../../services/key-event-handler-registry';
import { ChromeHTMLAudioElement, RecordingItem, ScaleKey, SupportedOctave } from '../../types';
import { checkFileExistence, deleteFile, getLSKey, join, readFile, writeFile } from '../../utils';
import { useInitializerRef } from '../../utils/useInitializerRef';
import BackButton from '../back-button';

import NoteFrequencyMap from './note-to-frequency';
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

type RecordingState = { [k: string]: boolean };

export const RecordingPage: FC<RecordingPageProps> = ({ onBack, recordingItems, basePath, scaleKey, octave }) => {
  const [[recordKey, playKey, playScaleKey]] = useState(['R', ' ', 'S']);
  const {
    deviceStatus: { audioOutputDeviceId },
  } = useContext(DeviceContext);
  const { audioInputStream } = useContext(AudioInputStreamContext);
  const [state, setState] = useState<State>('idle');
  const prevState = usePrevious(state);
  log.info(`prevState`, prevState, `state`, state);
  const [index = 0, setIndex] = useLocalStorage(getLSKey('RecordingPage', 'index'), 0);
  const recordingStateRef = useRef<RecordingState>({});
  const audioPlayBackRef = useRef<ChromeHTMLAudioElement>(null);
  const audioCtxRef = useInitializerRef<AudioContext>(() => new AudioContext());
  const rerender = useUpdate();

  const updateProjectFileStatus = (): Promise<void> => {
    log.info('Update project file status');
    const previousState = recordingStateRef.current;
    const state: RecordingState = {};
    return Promise.all(
      recordingItems.map(({ fileSystemName }) => {
        state[fileSystemName] = previousState[fileSystemName];
        const filePath = join(basePath, `${fileSystemName}.wav`);
        return checkFileExistence(filePath)
          .then((result) => {
            state[fileSystemName] = result === 'file';
          })
          .catch(log.error);
      }),
    ).then(() => {
      recordingStateRef.current = state;
    });
  };

  useEffect(() => {
    updateProjectFileStatus().catch(log.error);
  });

  useEffect((): void => {
    log.debug('Update studio output sink ID', ...[audioPlayBackRef, audioOutputDeviceId]);
    const audioElement = audioPlayBackRef.current;
    if (!audioElement) {
      return;
    }
    audioElement.setSinkId(audioOutputDeviceId).catch(log.error);
  }, [audioPlayBackRef, audioOutputDeviceId]);

  const stopPlayingScaleRef = useRef(noOp());
  const startPlayingScale = (): void => {
    log.debug('Start playing scale called');
    const audioElement = audioPlayBackRef.current;
    if (!audioElement) {
      return;
    }

    const audioCtx = audioCtxRef.current;

    stopPlayingScaleRef.current = (): void => {
      log.debug('Stop playing scale called');
      audioElement.srcObject = null;
      setState('idle');
    };

    const frequency = NoteFrequencyMap[`${scaleKey}${octave}`];
    if (!frequency) {
      return;
    }
    const oscillator = new OscillatorNode(audioCtx, {
      frequency,
    });
    const destination = audioCtx.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    // FIXME: Temporarily disabling this because it doesn't play well with push to play
    // setTimeout(stopPlayingScaleRef.current, 2000);
    audioElement.srcObject = destination.stream;
  };

  const stopPlayingRef = useRef(noOp());
  const startPlaying = (): void => {
    log.debug('Start playing called');
    let cancelled = false;
    const audioElement = audioPlayBackRef.current;
    if (!audioElement) {
      return;
    }
    stopPlayingRef.current = (): void => {
      log.debug('Stop playing called');
      cancelled = true;
      audioElement.src = '';
      audioElement.onended = null;
      setState('idle');
    };
    audioElement.onended = stopPlayingRef.current;
    (async (): Promise<void> => {
      log.debug('Reading wav file from disk');
      const filePath = join(basePath, `${recordingItems[index].fileSystemName}.wav`);
      const data = await readFile(filePath, true);
      if (cancelled) {
        return;
      }
      const blob = new Blob([new Uint8Array(data)]);
      audioElement.src = URL.createObjectURL(blob);
    })();
  };

  const stopRecordingRef = useRef(noOp());
  const startRecording = (): void => {
    log.debug('Start recording called');
    if (!audioInputStream) {
      return;
    }
    const audioCtx = audioCtxRef.current;

    let cancelled = false;
    const recordedChunks: Blob[] = [];
    const recorder = new MediaRecorder(audioInputStream);
    (async (): Promise<void> => {
      const fileSystemName = recordingItems[index]?.fileSystemName;
      const filePath = join(basePath, `${fileSystemName}.wav`);
      log.info(filePath, recordingStateRef.current[fileSystemName]);
      if (recordingStateRef.current[fileSystemName]) {
        await deleteFile(filePath);
        recordingStateRef.current[filePath] = false;
        rerender();
      }
      log.debug('Recorder starting');
      if (!cancelled) {
        recorder.start();
      }
    })();

    recorder.ondataavailable = (e): void => {
      log.debug('New recorded data available');
      recordedChunks.push(e.data);
    };

    stopRecordingRef.current = (): void => {
      log.debug('Stop recording called');
      cancelled = true;
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      setState('idle');
    };

    recorder.onstop = (): void => {
      if (!recordedChunks.length) {
        alert('No data recorded');
      }
      recorder.onstop = null;
      const finalBlob = new Blob(recordedChunks);
      const reader = new FileReader();
      const filePath = join(basePath, `${recordingItems[index].fileSystemName}.wav`);
      reader.onload = (): void => {
        const { result } = reader;
        if (result === null) {
          alert('Nothing recorded!');
          return;
        }
        if (typeof result === 'string') {
          alert(`Result happens to be string: ${result}`);
          return;
        }
        audioCtx
          .decodeAudioData(result)
          .then((audioBuffer) => toWav(audioBuffer))
          .then((convertedBuffer) => writeFile(filePath, Buffer.from(convertedBuffer), 'binary'))
          .then(() => alert(`File written to: ${filePath}`))
          .then(() => stopRecordingRef.current())
          .then(updateProjectFileStatus)
          .then(rerender);
      };
      reader.readAsArrayBuffer(finalBlob);
    };
  };

  useEffect(() => {
    log.debug('State management callback', 'prevState', prevState, 'state', state);
    if (prevState === 'idle' && state === 'recording') {
      startRecording();
    } else if (prevState === 'idle' && state === 'playing') {
      startPlaying();
    } else if (prevState === 'idle' && state === 'playing-scale') {
      startPlayingScale();
    } else if (prevState === 'recording' && state === 'idle') {
      stopRecordingRef.current();
    } else if (prevState === 'recording' && state === 'playing') {
      stopRecordingRef.current();
      setImmediate(startPlaying);
    } else if (prevState === 'recording' && state === 'playing-scale') {
      stopRecordingRef.current();
      setImmediate(startPlayingScale);
    } else if (prevState === 'playing' && state === 'idle') {
      stopPlayingRef.current();
    } else if (prevState === 'playing' && state === 'recording') {
      stopPlayingRef.current();
      setImmediate(startRecording);
    } else if (prevState === 'playing' && state === 'playing-scale') {
      stopPlayingRef.current();
      setImmediate(startPlayingScale);
    } else if (prevState === 'playing-scale' && state === 'idle') {
      stopPlayingScaleRef.current();
    } else if (prevState === 'playing-scale' && state === 'recording') {
      stopPlayingScaleRef.current();
      setImmediate(startRecording);
    } else if (prevState === 'playing-scale' && state === 'playing') {
      stopPlayingScaleRef.current();
      setImmediate(startPlaying);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevState, state]);

  const onUnloadHandler = (): void => {
    stopRecordingRef.current();
    stopPlayingRef.current();
    stopPlayingScaleRef.current();
  };
  useEffect(() => {
    window.addEventListener('unload', onUnloadHandler);
    return (): void => window.removeEventListener('unload', onUnloadHandler);
  });

  useEffect((): (() => void) => {
    log.debug('Set up handlers');
    const handleKeyEvent = (isDown: boolean): EventListener => {
      return (event): void => {
        log.debug('Update on key event', isDown ? 'keydown' : 'keyup');
        const castedEvent = event as KeyboardEvent;
        if (castedEvent.defaultPrevented) {
          return;
        }
        const { key } = castedEvent;
        const keyUpperCase = key.toLocaleUpperCase();
        let processed = false;
        switch (state) {
          case 'playing':
            if (!isDown) {
              if (keyUpperCase === playKey) {
                setState('idle');
                processed = true;
              }
            } else if (keyUpperCase === playKey) {
              processed = true;
            }
            break;
          case 'recording':
            if (!isDown) {
              if (keyUpperCase === recordKey) {
                setState('idle');
                processed = true;
              }
            } else if (keyUpperCase === recordKey) {
              processed = true;
            }
            break;
          case 'playing-scale':
            if (!isDown) {
              if (keyUpperCase === playScaleKey) {
                setState('idle');
                processed = true;
              }
            } else if (keyUpperCase === playScaleKey) {
              processed = true;
            }
            break;
          case 'idle':
          default:
            if (isDown) {
              if (keyUpperCase === playKey) {
                if (!castedEvent.repeat) {
                  setState('playing');
                }
                processed = true;
              } else if (keyUpperCase === recordKey) {
                if (!castedEvent.repeat) {
                  setState('recording');
                }
                processed = true;
              } else if (keyUpperCase === playScaleKey) {
                if (!castedEvent.repeat) {
                  setState('playing-scale');
                }
                processed = true;
              }
            }
            break;
        }

        if (processed) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
    };

    const [keyDownHandler, keyUpHandler] = [handleKeyEvent(true), handleKeyEvent(false)];
    addGlobalKeyDownHandler(keyDownHandler);
    addGlobalKeyUpHandler(keyUpHandler);
    return (): void => {
      removeGlobalKeyDownHandler(keyDownHandler);
      removeGlobalKeyUpHandler(keyUpHandler);
    };
  }, [playKey, playScaleKey, recordKey, state]);

  log.info(recordingStateRef.current);
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
            audioElement={audioPlayBackRef.current || undefined}
            filePath={
              recordingStateRef.current[recordingItems[index]?.fileSystemName]
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
      <audio autoPlay={true} muted={false} ref={audioPlayBackRef} />
    </Fragment>
  );
};
