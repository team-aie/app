// import log from 'electron-log';
// import { useEffect, useRef } from 'react';
// import useUpdate from 'react-use/lib/useUpdate';
//
// import { RecordingItem, UnaryOperator } from '../../types';
// import { checkFileExistence, deleteFile, join, readFile, writeFile } from '../../utils';
// import { noOp } from '../../env-and-consts';
// import toWav from 'audiobuffer-to-wav';
// import NoteFrequencyMap from './note-to-frequency';
//
// type RecordingState = { [k: string]: boolean };
//
// export const useWatchingProjectFileState = (
//   recordingItems: RecordingItem[],
//   basePath: string,
// ): {
//   updateProjectFileStatus: (updateFunc: UnaryOperator<RecordingState>) => void;
//   recordingState: RecordingState;
// } => {
//   const recordingStateRef = useRef<RecordingState>({});
//   const rerender = useUpdate();
//
//   const checkProjectFileStatus = (): Promise<void> => {
//     log.info('Update project file status');
//     const previousState = recordingStateRef.current;
//     const state: RecordingState = {};
//     let changed = false;
//     return Promise.all(
//       recordingItems.map(({ fileSystemName }) => {
//         state[fileSystemName] = previousState[fileSystemName];
//         const filePath = join(basePath, `${fileSystemName}.wav`);
//         return checkFileExistence(filePath)
//           .then((result) => {
//             state[fileSystemName] = result === 'file';
//             if (state[fileSystemName] !== previousState[fileSystemName]) {
//               changed = true;
//             }
//           })
//           .catch(log.error);
//       }),
//     ).then(() => {
//       if (changed) {
//         recordingStateRef.current = state;
//         rerender();
//       }
//     });
//   };
//
//   const updateProjectFileStatus = (updateFunc: UnaryOperator<RecordingState>) => {
//     recordingStateRef.current = updateFunc(recordingStateRef.current);
//     rerender();
//   };
//
//   useEffect(() => {
//     checkProjectFileStatus().catch(log.error);
//   });
//
//   return {
//     updateProjectFileStatus,
//     recordingState: recordingStateRef.current || {},
//   };
// };
//
// export const useToggleRecording = () => {
//   const stopRecordingRef = useRef(noOp());
//   const startRecording = (): void => {
//     log.debug('Start recording called');
//     if (!audioInputStream) {
//       return;
//     }
//     const audioCtx = audioCtxRef.current;
//
//     let cancelled = false;
//     const recordedChunks: Blob[] = [];
//     const recorder = new MediaRecorder(audioInputStream);
//     (async (): Promise<void> => {
//       const fileSystemName = recordingItems[index]?.fileSystemName;
//       const filePath = join(basePath, `${fileSystemName}.wav`);
//       log.info(filePath, recordingState[fileSystemName]);
//       if (recordingState[fileSystemName]) {
//         await deleteFile(filePath);
//         updateProjectFileStatus(() => ({ ...recordingState, [filePath]: false }));
//       }
//       log.debug('Recorder starting');
//       if (!cancelled) {
//         recorder.start();
//       }
//     })();
//
//     recorder.ondataavailable = (e): void => {
//       log.debug('New recorded data available');
//       recordedChunks.push(e.data);
//     };
//
//     stopRecordingRef.current = (): void => {
//       log.debug('Stop recording called');
//       cancelled = true;
//       if (recorder.state !== 'inactive') {
//         recorder.stop();
//       }
//       setState('idle');
//     };
//
//     recorder.onstop = (): void => {
//       if (!recordedChunks.length) {
//         alert('No data recorded');
//       }
//       recorder.onstop = null;
//       const finalBlob = new Blob(recordedChunks);
//       const reader = new FileReader();
//       const filePath = join(basePath, `${recordingItems[index].fileSystemName}.wav`);
//       reader.onload = (): void => {
//         const { result } = reader;
//         if (result === null) {
//           alert('Nothing recorded!');
//           return;
//         }
//         if (typeof result === 'string') {
//           alert(`Result happens to be string: ${result}`);
//           return;
//         }
//         audioCtx
//           .decodeAudioData(result)
//           .then((audioBuffer) => toWav(audioBuffer))
//           .then((convertedBuffer) => writeFile(filePath, Buffer.from(convertedBuffer), 'binary'))
//           .then(() => alert(`File written to: ${filePath}`))
//           .then(() => stopRecordingRef.current())
//           .then(() => updateProjectFileStatus(() => ({ ...recordingState, [filePath]: true })));
//       };
//       reader.readAsArrayBuffer(finalBlob);
//     };
//   };
//
//   return [stopRecordingRef];
// }
//
// const useTogglePlaying = () => {
//   const stopPlayingRef = useRef(noOp());
//   const startPlaying = (): void => {
//     log.debug('Start playing called');
//     let cancelled = false;
//     const audioElement = audioPlayBackRef.current;
//     if (!audioElement) {
//       return;
//     }
//     stopPlayingRef.current = (): void => {
//       log.debug('Stop playing called');
//       cancelled = true;
//       audioElement.src = '';
//       audioElement.onended = null;
//       setState('idle');
//     };
//     audioElement.onended = stopPlayingRef.current;
//     (async (): Promise<void> => {
//       log.debug('Reading wav file from disk');
//       const filePath = join(basePath, `${recordingItems[index].fileSystemName}.wav`);
//       const data = await readFile(filePath, true);
//       if (cancelled) {
//         return;
//       }
//       const blob = new Blob([new Uint8Array(data)]);
//       audioElement.src = URL.createObjectURL(blob);
//     })();
//   };
//   return [];
// };
//
// const useTogglePlayingScale = () => {
//   const stopPlayingScaleRef = useRef(noOp());
//   const startPlayingScale = (): void => {
//     log.debug('Start playing scale called');
//     const audioElement = audioPlayBackRef.current;
//     if (!audioElement) {
//       return;
//     }
//
//     const audioCtx = audioCtxRef.current;
//
//     stopPlayingScaleRef.current = (): void => {
//       log.debug('Stop playing scale called');
//       audioElement.srcObject = null;
//       setState('idle');
//     };
//
//     const frequency = NoteFrequencyMap[`${scaleKey}${octave}`];
//     if (!frequency) {
//       return;
//     }
//     const oscillator = new OscillatorNode(audioCtx, {
//       frequency,
//     });
//     const destination = audioCtx.createMediaStreamDestination();
//     oscillator.connect(destination);
//     oscillator.start();
//     // FIXME: Temporarily disabling this because it doesn't play well with push to play
//     // setTimeout(stopPlayingScaleRef.current, 2000);
//     audioElement.srcObject = destination.stream;
//   };
// };
