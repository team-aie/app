import log from 'electron-log';

import { ACQUIRE_PERMISSION_RETRIES } from '../../common/env-and-consts';

import { readFile } from './fs-utils';
import { systemPreferences } from './isomorphic-electron';

export const acquireAudioInputStream = async (
  deviceId: string,
  sampleRate: number,
  sampleSize: number,
): Promise<MediaStream> => {
  const constraint: MediaStreamConstraints = {
    audio: {
      deviceId,
      sampleRate,
      sampleSize,
      channelCount: 1,
    },
  };

  for (let attemptCount = 0; attemptCount < ACQUIRE_PERMISSION_RETRIES; attemptCount++) {
    try {
      // `askForMediaAccess()` is only for macOS
      const microphoneApproved =
        (systemPreferences.askForMediaAccess && (await systemPreferences.askForMediaAccess('microphone'))) || true;
      if (microphoneApproved) {
        return await navigator.mediaDevices.getUserMedia(constraint);
      } else {
        // noinspection ExceptionCaughtLocallyJS as this was intentional
        throw new Error('Entire app was not given microphone access');
      }
    } catch (e) {
      log.warn('Microphone access failed to acquire', e);
      alert(
        `We need to record audio in order to proceed${
          attemptCount < ACQUIRE_PERMISSION_RETRIES - 1 ? ", let's try again." : '!'
        }`,
      );
    }
  }

  throw new Error('Failed to obtain microphone stream');
};

export const readWavAsBlob = async (filePath: string): Promise<Blob> => {
  const data = await readFile(filePath, true);
  return new Blob([new Uint8Array(data)]);
};
