import log from 'electron-log';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import useUpdate from 'react-use/lib/useUpdate';

import { noOp } from '../../../common/env-and-consts';
import {
  addGlobalKeyDownHandler,
  addGlobalKeyUpHandler,
  removeGlobalKeyDownHandler,
  removeGlobalKeyUpHandler,
} from '../../services/key-event-handler-registry';
import mediaService from '../../services/media';
import { Consumer, RecordingItem, ScaleKey, SupportedOctave, UnaryOperator } from '../../types';
import { checkFileExistence, deleteFile, join, readWavAsBlob, writeArrayBufferToFile } from '../../utils';

import NoteFrequencyMap from './note-to-frequency';
import { RecordingFileState, State } from './types';

export const useWatchingProjectFileState = (
  recordingItems: RecordingItem[],
  basePath: string,
): {
  updateProjectFileStatus: (updateFunc: UnaryOperator<RecordingFileState>) => void;
  recordingState: RecordingFileState;
} => {
  const recordingStateRef = useRef<RecordingFileState>({});
  const rerender = useUpdate();

  const checkProjectFileStatus = (): Promise<void> => {
    log.info('Update project file status');
    const previousState = recordingStateRef.current;
    const state: RecordingFileState = {};
    let changed = false;
    return Promise.all(
      recordingItems.map(({ fileSystemName }) => {
        state[fileSystemName] = previousState[fileSystemName];
        const filePath = join(basePath, `${fileSystemName}.wav`);
        return checkFileExistence(filePath)
          .then((result) => {
            state[fileSystemName] = result === 'file';
            if (state[fileSystemName] !== previousState[fileSystemName]) {
              changed = true;
            }
          })
          .catch(log.error);
      }),
    ).then(() => {
      if (changed) {
        recordingStateRef.current = state;
        rerender();
      }
    });
  };

  const updateProjectFileStatus = (updateFunc: UnaryOperator<RecordingFileState>) => {
    recordingStateRef.current = updateFunc(recordingStateRef.current);
    rerender();
  };

  useEffect(() => {
    checkProjectFileStatus().catch(log.error);
  });

  return {
    updateProjectFileStatus,
    recordingState: recordingStateRef.current || {},
  };
};

export const useToggleRecording = (
  state: State,
  setState: Consumer<State>,
  recordingItems: RecordingItem[],
  basePath: string,
  index: number,
  recordingState: RecordingFileState,
  updateProjectFileStatus: Consumer<UnaryOperator<RecordingFileState>>,
): [MutableRefObject<() => void>, () => void] => {
  const stopRecordingRef = useRef(noOp());
  const startRecording = (): void => {
    log.debug('Start recording called');
    let cancelled = false;

    stopRecordingRef.current = (): void => {
      log.debug('Stop recording called');
      cancelled = true;
      mediaService.stopRecording();
      stopRecordingRef.current = noOp();
      setState('idle');
    };

    (async (): Promise<void> => {
      const fileSystemName = recordingItems[index]?.fileSystemName;
      const filePath = join(basePath, `${fileSystemName}.wav`);
      log.info(filePath, recordingState[fileSystemName]);
      if (recordingState[fileSystemName]) {
        await deleteFile(filePath);
        updateProjectFileStatus((state) => ({ ...state, [filePath]: false }));
      }
      log.debug('Recorder starting');
      if (!cancelled) {
        const recordedBlob = await mediaService.startRecording();
        const recordedArrayBuffer = await mediaService.audioBlobToWavArrayBuffer(recordedBlob);
        try {
          await writeArrayBufferToFile(filePath, recordedArrayBuffer);
          alert(`File written to: ${filePath}`);
          updateProjectFileStatus((state) => ({ ...state, [filePath]: true }));
        } catch (e) {
          log.error(`Failed to write to ${filePath}`, e);
        }
      }
    })();
  };

  return [stopRecordingRef, startRecording];
};

export const useTogglePlaying = (
  state: State,
  setState: Consumer<State>,
  recordingItems: RecordingItem[],
  basePath: string,
  index: number,
): [MutableRefObject<() => void>, () => void] => {
  const stopPlayingRef = useRef(noOp());
  const startPlaying = (): void => {
    log.debug('Start playing called');
    let cancelled = false;
    stopPlayingRef.current = (): void => {
      log.debug('Stop playing called');
      cancelled = true;
      mediaService.stopPlaying().catch(log.error);
      stopPlayingRef.current = noOp();
      setState('idle');
    };
    readWavAsBlob(join(basePath, `${recordingItems[index].fileSystemName}.wav`)).then((blob) => {
      if (!cancelled) {
        mediaService.createNewAudioGraph();
        mediaService
          .playBlob(blob)
          .then((): void => stopPlayingRef.current())
          .catch(log.error);
      }
    });
  };
  return [stopPlayingRef, startPlaying];
};

export const useTogglePlayingScale = (
  state: State,
  setState: Consumer<State>,
  scaleKey: ScaleKey,
  octave: SupportedOctave,
): [MutableRefObject<() => void>, () => void] => {
  const stopPlayingScaleRef = useRef(noOp());
  const startPlayingScale = (): void => {
    log.debug('Start playing scale called');
    const frequency = NoteFrequencyMap[`${scaleKey}${octave}`];
    if (!frequency) {
      return;
    }
    mediaService.createNewAudioGraph();
    const oscillator = mediaService.createOscillator({
      frequency,
    });
    log.debug(`Created oscillator at frequency ${frequency}`);
    stopPlayingScaleRef.current = (): void => {
      log.debug('Stop playing scale called');
      oscillator.stop();
      mediaService.stopPlaying().catch(log.error);
      stopPlayingScaleRef.current = noOp();
      setState('idle');
    };

    mediaService.playAudioNode(oscillator).then(stopPlayingScaleRef.current).catch(log.error);
    // FIXME: Temporarily disabling this because it doesn't play well with push to play
    // setTimeout(stopPlayingScaleRef.current, 2000);
  };

  return [stopPlayingScaleRef, startPlayingScale];
};

export const useRecordingPageLifeCycle = (
  prevState: State | undefined,
  state: State,
  setState: Consumer<State>,
  recordingItems: RecordingItem[],
  basePath: string,
  index: number,
  recordingState: RecordingFileState,
  updateProjectFileStatus: Consumer<UnaryOperator<RecordingFileState>>,
  scaleKey: ScaleKey,
  octave: SupportedOctave,
): void => {
  const [stopRecordingRef, startRecording] = useToggleRecording(
    state,
    setState,
    recordingItems,
    basePath,
    index,
    recordingState,
    updateProjectFileStatus,
  );
  const [stopPlayingRef, startPlaying] = useTogglePlaying(state, setState, recordingItems, basePath, index);
  const [stopPlayingScaleRef, startPlayingScale] = useTogglePlayingScale(state, setState, scaleKey, octave);

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
};

export const useHotKeyHandlers = (state: State, setState: Consumer<State>): void => {
  const [[recordKey, playKey, playScaleKey]] = useState(['R', ' ', 'S']);

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
  }, [playKey, playScaleKey, recordKey, setState, state]);
};
