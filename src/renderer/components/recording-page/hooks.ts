import log from 'electron-log';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import usePrevious from 'react-use/lib/usePrevious';

import { noOp } from '../../../common/env-and-consts';
import mediaService from '../../services/media';
import { Consumer, RecordingItem, ScaleKey, SupportedOctave, UnaryOperator } from '../../types';
import { deleteFile, join, naiveSerialize, readWavAsBlob, writeArrayBufferToFile } from '../../utils';
import { useInitializerRef } from '../../utils/use-initializer-ref';

import NoteFrequencyMap from './note-to-frequency';
import { ProjectFileStateService } from './project-file-state-service';
import { RecordingPageStateService } from './recording-page-state-service';
import { RecordingFileState } from './types';

export const useWatchingProjectFileState = (
  recordingItems: RecordingItem[],
  basePath: string,
): {
  // TODO: Deprecated. Remove later.
  updateProjectFileStatus: (updateFunc: UnaryOperator<RecordingFileState>) => void;
  recordingState: RecordingFileState;
} => {
  const [recordingState, setRecordingState] = useState<RecordingFileState>({});
  const projectFileStateServiceRef = useRef<ProjectFileStateService>();
  useEffect(() => {
    log.info(
      '[useWatchingProjectFileState] Creating new ProjectFileStateService because basePath has been updated to',
      basePath,
    );

    const serviceInstance = new ProjectFileStateService(basePath);
    projectFileStateServiceRef.current = serviceInstance;

    const subscription = serviceInstance.recordingFileState$.subscribe((state) => setRecordingState(state));

    return () => {
      subscription.unsubscribe();
      serviceInstance.close();
    };
  }, [basePath]);

  useEffect(() => {
    log.info(
      '[useWatchingProjectFileState] Need to update recording items on ProjectFileStateService to',
      recordingItems,
    );
    const projectFileStateService = projectFileStateServiceRef.current;
    if (projectFileStateService) {
      projectFileStateService.setRecordingItems(recordingItems);
    } else {
      log.info(
        '[useWatchingProjectFileState] Not updating recording items on ProjectFileStateService because it is not initialized',
      );
    }
    // Just checking recordingItems is not enough, because the comparison is by reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naiveSerialize(recordingItems)]);

  useEffect(() => {
    log.info('[useWatchingProjectFileState] Need to check project file state');
    const projectFileStateService = projectFileStateServiceRef.current;
    if (projectFileStateService) {
      projectFileStateService.checkProjectFileStatus();
    } else {
      log.info(
        '[useWatchingProjectFileState] Not checking recording items on ProjectFileStateService because it is not initialized',
      );
    }
  });

  return {
    updateProjectFileStatus: noOp(),
    recordingState,
  };
};

export const useToggleRecording = (
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
    };
    readWavAsBlob(join(basePath, `${recordingItems[index]?.fileSystemName}.wav`)).then((blob) => {
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
    };

    mediaService.playAudioNode(oscillator).then(stopPlayingScaleRef.current).catch(log.error);
    // FIXME: Temporarily disabling this because it doesn't play well with push to play
    // setTimeout(stopPlayingScaleRef.current, 2000);
  };

  return [stopPlayingScaleRef, startPlayingScale];
};

export const useRecordingPageLifeCycle = (
  recordingItems: RecordingItem[],
  basePath: string,
  index: number,
  rawSetIndex: Consumer<number>,
  recordingState: RecordingFileState,
  updateProjectFileStatus: Consumer<UnaryOperator<RecordingFileState>>,
  scaleKey: ScaleKey,
  octave: SupportedOctave,
): [RecordingPageStateService, Consumer<number>] => {
  const stateService = useInitializerRef(() => new RecordingPageStateService()).current;
  const { state } = stateService;
  const prevState = usePrevious(state);
  log.info(`prevState`, prevState, `state`, state);

  const [stopRecordingRef, startRecording] = useToggleRecording(
    recordingItems,
    basePath,
    index,
    recordingState,
    updateProjectFileStatus,
  );
  const [stopPlayingRef, startPlaying] = useTogglePlaying(recordingItems, basePath, index);
  const [stopPlayingScaleRef, startPlayingScale] = useTogglePlayingScale(scaleKey, octave);
  useHotKeyHandlers(stateService);

  const setIndex = (nextIndex: number) => {
    stateService.dispatch('navigate', () => rawSetIndex(nextIndex));
  };

  stateService.with(
    startRecording,
    stopRecordingRef.current,
    startPlaying,
    stopPlayingRef.current,
    startPlayingScale,
    stopPlayingScaleRef.current,
  );

  const onUnloadHandler = (): void => {
    stopRecordingRef.current();
    stopPlayingRef.current();
    stopPlayingScaleRef.current();
  };
  useEffect(() => {
    window.addEventListener('unload', onUnloadHandler);
    return (): void => window.removeEventListener('unload', onUnloadHandler);
  });

  return [stateService, setIndex];
};

export const useHotKeyHandlers = (stateService: RecordingPageStateService): void => {
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
        switch (keyUpperCase) {
          case playKey:
            stateService.dispatch('toggle-playing');
            processed = true;
            break;
          case recordKey:
            stateService.dispatch('toggle-recording');
            processed = true;
            break;
          case playScaleKey:
            stateService.dispatch('toggle-playing-scale');
            processed = true;
            break;
        }

        if (processed) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
    };

    const [keyDownHandler, keyUpHandler] = [handleKeyEvent(true), handleKeyEvent(false)];
    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);

    return (): void => {
      window.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('keyup', keyUpHandler);
    };
  }, [playKey, playScaleKey, recordKey, stateService]);
};
