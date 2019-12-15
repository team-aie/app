import * as fs from 'fs';
import * as path from 'path';

import toWav from 'audiobuffer-to-wav';
import * as log from 'electron-log';
import React, { Fragment, ReactElement, RefObject, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from 'react-use';
import { Button, Checkbox, Grid, Header } from 'semantic-ui-react';

import {
  addGlobalKeyDownHandler,
  addGlobalKeyUpHandler,
  removeGlobalKeyDownHandler,
  removeGlobalKeyUpHandler,
} from '../../services/key-event-handler-registry';
import { ChromeHTMLAudioElement, Consumer, PageState, RecordedVoiceItem, RecordingItem } from '../../types';
import AudioSettings from '../audio-settings';
import SizedDiv from '../sized-div';

import NoteFrequencyMap from './note-to-frequency';

interface RecordingStudioProps {
  recordingList: RecordingItem[];
  projectFolder: string;
  scales: string[];
  setPageState: Consumer<PageState>;
}

interface VoiceSamplesOnFileSystemState {
  [scale: string]: RecordedVoiceItem[];
}

const ensureFolderExists = async (folderPath: string): Promise<void> => {
  if (!fs.existsSync(folderPath) || !(await fs.promises.lstat(folderPath)).isDirectory()) {
    return fs.promises.mkdir(folderPath);
  }
};

const fileExistsAndIsNotEmpty = async (filePath: string): Promise<boolean> => {
  if (fs.existsSync(filePath)) {
    const fileStats = await fs.promises.lstat(filePath);
    return fileStats.isFile() && fileStats.size > 0;
  }
  return false;
};

interface VoiceItemSelectorProps {
  recordingList: RecordingItem[];
  recordingItemIndex: number;
  setVoiceItemIndex: Consumer<number>;
  currentVoiceItemRef: RefObject<HTMLDivElement>;
  recordingFileExistList: boolean[];
}

const VoiceItemSelector = ({
  recordingList,
  recordingItemIndex,
  setVoiceItemIndex,
  currentVoiceItemRef,
  recordingFileExistList,
}: VoiceItemSelectorProps): ReactElement => {
  return (
    <Fragment>
      {recordingList.map(
        (recordingItem, i): ReactElement => {
          return (
            <div
              key={i}
              onClick={(): void => setVoiceItemIndex(i)}
              ref={i === recordingItemIndex ? currentVoiceItemRef : undefined}
              style={!recordingFileExistList[i] ? { fontStyle: 'italic', fontWeight: 'bolder' } : undefined}>
              {recordingItem.displayText + (recordingItemIndex === i ? ': Selected' : '')}
            </div>
          );
        },
      )}
    </Fragment>
  );
};

interface ScaleSelectorProps {
  scales: string[];
  scaleIndex: number;
  setScaleIndex: Consumer<number>;
  studioState: StudioState;
}

export const enum StudioState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PLAYING = 'playing',
  PLAYING_SCALE = 'playing-scale',
}

const ScaleSelector = ({ scales, scaleIndex, setScaleIndex, studioState }: ScaleSelectorProps): ReactElement => {
  return (
    <Grid.Column>
      {scales.map(
        (scale, i): ReactElement => {
          return (
            <Button
              key={i}
              onClick={(): void => setScaleIndex(i)}
              disabled={i === scaleIndex || studioState !== StudioState.IDLE}>
              {scale}
            </Button>
          );
        },
      )}
    </Grid.Column>
  );
};

const RecordingStudio = ({
  recordingList,
  projectFolder,
  scales,
  setPageState,
}: RecordingStudioProps): ReactElement => {
  const [recordingFileState, setRecordingFileState] = useState({} as VoiceSamplesOnFileSystemState);
  const [scaleIndex, setScaleIndex] = useLocalStorage('scaleIndex', 0);
  const [recordingItemIndex, setVoiceItemIndex] = useLocalStorage('recordingItemIndex', 0);
  const [studioState, setStudioState] = useState(StudioState.IDLE);
  const recordedChunks = useRef([] as Blob[]).current;
  const audioPlayBackRef = useRef<ChromeHTMLAudioElement>(null);
  const currentVoiceItemRef = useRef<HTMLDivElement>(null);
  const [inputDeviceId, setInputDeviceId] = useState('');
  const [outputDeviceId, setOutputDeviceId] = useState('');
  const [[recordKey, playKey, playScaleKey]] = useState(['R', ' ', 'S']);
  const [volume, setVolume] = useLocalStorage('volume', 100);
  const [usePTE, setUsePTE] = useLocalStorage('usePTE', true);
  const [showSavingAudioFilePrompt, setShowSavingAudioFilePrompt] = useLocalStorage('showSavingAudioFilePrompt', true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date());
  const updateFileStatusRef = useRef(async () => {
    return [false, {}] as [boolean, VoiceSamplesOnFileSystemState];
  });

  updateFileStatusRef.current = async (): Promise<[boolean, VoiceSamplesOnFileSystemState]> => {
    log.debug('Update file status');
    if (recordingList.length && projectFolder && scales.length) {
      let changed = false;
      const newRecordingFileState: VoiceSamplesOnFileSystemState = {};
      await ensureFolderExists(projectFolder);
      await Promise.all(
        scales.map(
          async (scale): Promise<void> => {
            const subFolderPath = path.join(projectFolder, scale);
            await ensureFolderExists(subFolderPath);

            if (!recordingFileState[scale]) {
              changed = true;
            }

            newRecordingFileState[scale] = await Promise.all(
              recordingList.map(
                async (recordingItem, i): Promise<RecordedVoiceItem> => {
                  const recordingItemPath = path.join(subFolderPath, recordingItem.fileSystemName + '.wav');

                  const updatedState: RecordedVoiceItem = {
                    ...recordingItem,
                    audioExists: await fileExistsAndIsNotEmpty(recordingItemPath),
                  };
                  const diffNeeded = !changed && recordingFileState[scale];
                  if (diffNeeded) {
                    const previousState: RecordedVoiceItem = recordingFileState[scale][i];

                    changed = !(
                      previousState.audioExists === updatedState.audioExists &&
                      previousState.fileSystemName === updatedState.fileSystemName
                    );
                  }
                  return updatedState;
                },
              ),
            );
          },
        ),
      );
      return [changed, newRecordingFileState];
    } else {
      return [false, {}];
    }
  };

  const onRecorderStopRef = useRef(() => {
    // Intentionally left blank
  });
  onRecorderStopRef.current = (): void => {
    if (!recordedChunks.length) {
      alert('No data recorded');
    }
    const finalBlob = new Blob(recordedChunks);
    recordedChunks.splice(0, recordedChunks.length);
    const reader = new FileReader();
    const { fileSystemName } = recordingFileState[scales[scaleIndex]][recordingItemIndex];
    const filePath = path.join(projectFolder, scales[scaleIndex], fileSystemName);
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

      const decodeAudioContext = new AudioContext();
      decodeAudioContext
        .decodeAudioData(result)
        .then((audioBuffer): ArrayBuffer => toWav(audioBuffer))
        .then(
          (convertedBuffer): Promise<void> =>
            fs.promises.writeFile(`${filePath}.wav`, Buffer.from(convertedBuffer), 'binary'),
        )
        .then(() => showSavingAudioFilePrompt && alert(`File written to: ${filePath}.wav`));
    };
    reader.readAsArrayBuffer(finalBlob);
  };

  useEffect(() => {
    log.debug('Regular scheduled update');
    const updateIntervalTimeout = setTimeout(() => {
      const nextUpdateTime = new Date();
      log.debug('Starting next update', nextUpdateTime);
      setLastUpdatedTime(nextUpdateTime);
    }, 2000);
    return (): void => clearTimeout(updateIntervalTimeout);
  });

  useEffect((): void => {
    log.debug('Update file status in effect hook');
    updateFileStatusRef.current().then(([changed, newFileState]) => {
      if (changed) {
        setRecordingFileState(newFileState);
      }
    });
  });

  useEffect((): void => {
    log.debug('Set recording item focus');
    const currentVoiceItemElement = currentVoiceItemRef.current;
    if (currentVoiceItemElement) {
      currentVoiceItemElement.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [recordingItemIndex]);

  useEffect((): (() => void) => {
    log.debug('Update studio audio playback');
    const audioPlayBackElement = audioPlayBackRef.current;
    let cancelled = false;
    let onUnmountCallback = (): void => undefined;
    updateFileStatusRef.current().then(([changed]) => {
      if (
        !cancelled &&
        !changed &&
        audioPlayBackElement &&
        studioState === StudioState.PLAYING &&
        recordingFileState[scales[scaleIndex]] &&
        recordingFileState[scales[scaleIndex]][recordingItemIndex].audioExists
      ) {
        return (async (): Promise<void> => {
          const filePath = path.join(
            projectFolder,
            scales[scaleIndex],
            `${recordingFileState[scales[scaleIndex]][recordingItemIndex].fileSystemName}.wav`,
          );
          const data = await fs.promises.readFile(filePath);
          const blob = new Blob([new Uint8Array(data)]);
          audioPlayBackElement.src = URL.createObjectURL(blob);
          audioPlayBackElement.onended = (): void => setStudioState(StudioState.IDLE);

          onUnmountCallback = (): void => {
            audioPlayBackElement.src = '';
            audioPlayBackElement.onended = null;
          };
        })();
      } else {
        return (async (): Promise<void> => undefined)();
      }
    });
    return (): void => {
      cancelled = true;
      onUnmountCallback();
    };
  }, [audioPlayBackRef, projectFolder, recordingFileState, scaleIndex, scales, studioState, recordingItemIndex]);

  useEffect(() => {
    log.debug('Play scale');
    if (!scales.length || !scales[scaleIndex]) {
      return;
    }
    const audioElement = audioPlayBackRef.current;
    if (!audioElement) {
      return;
    }
    const audioCtx = new AudioContext();
    if (![StudioState.IDLE, StudioState.PLAYING_SCALE].includes(studioState)) {
      return;
    }

    const stopPlayingScale = (): void => {
      audioCtx.close();
      audioElement.srcObject = null;
      setStudioState(StudioState.IDLE);
    };
    if (studioState === StudioState.PLAYING_SCALE) {
      const frequency = NoteFrequencyMap[scales[scaleIndex]];
      if (!frequency) {
        return;
      }
      const oscillator = new OscillatorNode(audioCtx, {
        frequency,
      });
      const destination = audioCtx.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      setTimeout(stopPlayingScale, 2000);
      audioElement.srcObject = destination.stream;
    } else {
      stopPlayingScale();
    }
  }, [audioPlayBackRef, scaleIndex, scales, studioState]);

  useEffect((): void => {
    log.debug('Update studio output sink ID');
    const audioElement = audioPlayBackRef.current;
    if (!audioElement) {
      return;
    }
    audioElement.setSinkId(outputDeviceId);
  }, [audioPlayBackRef, outputDeviceId]);

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
        switch (studioState) {
          case StudioState.PLAYING:
            if (!isDown) {
              if (keyUpperCase === playKey) {
                setStudioState(StudioState.IDLE);
                processed = true;
              }
            } else if (keyUpperCase === playKey) {
              processed = true;
            }
            break;
          case StudioState.RECORDING:
            if (!isDown) {
              if (keyUpperCase === recordKey) {
                setStudioState(StudioState.IDLE);
                processed = true;
              }
            } else if (keyUpperCase === recordKey) {
              processed = true;
            }
            break;
          case StudioState.PLAYING_SCALE:
            if (!isDown) {
              if (keyUpperCase === playScaleKey) {
                setStudioState(StudioState.IDLE);
                processed = true;
              }
            } else if (keyUpperCase === playScaleKey) {
              processed = true;
            }
            break;
          case StudioState.IDLE:
          default:
            if (isDown) {
              if (keyUpperCase === playKey) {
                if (!castedEvent.repeat) {
                  setStudioState(StudioState.PLAYING);
                }
                processed = true;
              } else if (keyUpperCase === recordKey) {
                if (!castedEvent.repeat) {
                  setStudioState(StudioState.RECORDING);
                }
                processed = true;
              } else if (keyUpperCase === playScaleKey) {
                if (!castedEvent.repeat) {
                  setStudioState(StudioState.PLAYING_SCALE);
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
  }, [setStudioState, studioState, playKey, recordKey, playScaleKey]);

  useEffect((): void => {
    log.debug('Update studio output volume');
    const audioElement = audioPlayBackRef.current;
    if (audioElement) {
      audioElement.volume = volume / 100;
    }
  }, [audioPlayBackRef, volume]);

  log.debug(studioState);
  return (
    <Grid columns={16} divided={true}>
      <Grid.Row columns={1}>
        <Grid.Column>
          <Header as={'h4'}>Audio Settings</Header>
          <Button disabled={studioState !== StudioState.IDLE} onClick={(): void => setPageState('create-project')}>
            Back
          </Button>
        </Grid.Column>
      </Grid.Row>
      <AudioSettings
        recording={studioState}
        recordedChunks={recordedChunks}
        onRecorderStopRef={onRecorderStopRef}
        inputDeviceId={inputDeviceId}
        setInputDeviceId={setInputDeviceId}
        outputDeviceId={outputDeviceId}
        setOutputDeviceId={setOutputDeviceId}
        volume={volume}
        setVolume={setVolume}
        lastUpdatedTime={lastUpdatedTime}
      />
      <Grid.Row divided={false}>
        <Grid.Column width={5}>
          <SizedDiv height={40}>
            <VoiceItemSelector
              recordingList={recordingList}
              recordingItemIndex={recordingItemIndex}
              setVoiceItemIndex={setVoiceItemIndex}
              currentVoiceItemRef={currentVoiceItemRef}
              recordingFileExistList={
                recordingFileState[scales[scaleIndex]]
                  ? recordingFileState[scales[scaleIndex]].map((x) => x.audioExists || false)
                  : []
              }
            />
          </SizedDiv>
        </Grid.Column>
        <Grid.Column width={11}>
          <Grid columns={16}>
            <Grid.Row divided={true}>
              <Grid.Column width={5}>
                <Grid.Row>
                  <ScaleSelector
                    scales={scales}
                    scaleIndex={scaleIndex}
                    setScaleIndex={setScaleIndex}
                    studioState={studioState}
                  />
                </Grid.Row>
              </Grid.Column>
              <Grid.Column width={11}>
                <Grid.Row>
                  <Button
                    onClick={(): void => {
                      setStudioState(studioState === StudioState.RECORDING ? StudioState.IDLE : StudioState.RECORDING);
                    }}
                    secondary={studioState === StudioState.RECORDING}
                    disabled={!new Set([StudioState.IDLE, StudioState.RECORDING]).has(studioState)}>
                    {studioState === StudioState.RECORDING ? `Recording  ("${recordKey}")` : `Record  ("${recordKey}")`}
                  </Button>
                  <Button
                    onClick={(): void => {
                      setStudioState(studioState === StudioState.PLAYING ? StudioState.IDLE : StudioState.PLAYING);
                    }}
                    secondary={studioState === StudioState.PLAYING}
                    disabled={
                      !new Set([StudioState.IDLE, StudioState.PLAYING]).has(studioState) ||
                      !(
                        recordingFileState[scales[scaleIndex]] &&
                        recordingFileState[scales[scaleIndex]][recordingItemIndex].audioExists
                      )
                    }>
                    {studioState === StudioState.PLAYING ? `Playing ("${playKey}")` : `Play ("${playKey}")`}
                  </Button>
                  <Button
                    onClick={(): void => {
                      setStudioState(
                        studioState === StudioState.PLAYING_SCALE ? StudioState.IDLE : StudioState.PLAYING_SCALE,
                      );
                    }}
                    secondary={studioState === StudioState.PLAYING_SCALE}
                    disabled={!new Set([StudioState.IDLE, StudioState.PLAYING_SCALE]).has(studioState)}>
                    {studioState === StudioState.PLAYING_SCALE
                      ? `Playing Scale ("${playScaleKey}")`
                      : `Play Scale ("${playScaleKey}")`}
                  </Button>
                </Grid.Row>
                <Grid.Row>
                  <Checkbox
                    toggle={true}
                    disabled={studioState !== StudioState.IDLE}
                    checked={usePTE}
                    onChange={(): void => setUsePTE(!usePTE)}
                    label={'Push to execute (not working)'}
                  />
                </Grid.Row>
                <Grid.Row>
                  <Checkbox
                    toggle={true}
                    disabled={studioState !== StudioState.IDLE}
                    checked={showSavingAudioFilePrompt}
                    onChange={(): void => setShowSavingAudioFilePrompt(!showSavingAudioFilePrompt)}
                    label={'Show prompt of saving audio file'}
                  />
                </Grid.Row>
                <Grid.Row>
                  <Button
                    onClick={(): void => {
                      setVoiceItemIndex((recordingItemIndex - 1 + recordingList.length) % recordingList.length);
                    }}
                    disabled={studioState !== StudioState.IDLE}>
                    Previous Voice
                  </Button>
                  <Button
                    onClick={(): void => {
                      setVoiceItemIndex((recordingItemIndex + 1) % recordingList.length);
                    }}
                    disabled={studioState !== StudioState.IDLE}>
                    Next Voice
                  </Button>
                </Grid.Row>
                <Grid.Row>
                  <Button
                    onClick={(): void => {
                      setScaleIndex((scaleIndex - 1 + scales.length) % scales.length);
                    }}
                    disabled={studioState !== StudioState.IDLE}>
                    Previous Scale
                  </Button>
                  <Button
                    onClick={(): void => {
                      setScaleIndex((scaleIndex + 1) % scales.length);
                    }}
                    disabled={studioState !== StudioState.IDLE}>
                    Next Scale
                  </Button>
                </Grid.Row>
              </Grid.Column>
            </Grid.Row>
            <Grid.Row>
              {studioState === StudioState.RECORDING ? (
                <Header as={'h3'}>Recording In Progress...</Header>
              ) : (
                <pre>
                  {recordingFileState[scales[scaleIndex]] &&
                    JSON.stringify(recordingFileState[scales[scaleIndex]][recordingItemIndex], null, 2)}
                </pre>
              )}
              <audio autoPlay={true} muted={false} ref={audioPlayBackRef} />
            </Grid.Row>
          </Grid>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default RecordingStudio;
