/**
 * @jest-environment jsdom
 */
/* eslint-disable no-console */
/* eslint-disable jest/prefer-expect-assertions */

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { mocked } from 'ts-jest/utils';

import 'web-audio-test-api';
import { noOp } from '../../../common/env-and-consts';
import mediaService from '../../services/media';
import { readWavAsBlob } from '../../utils/media-utils';

import RecordingPage from './index';

// Mock the remote module to prevent import failure.
jest.mock('@electron/remote', () => ({ dialog: jest.fn() }));

jest.mock('../../utils/media-utils');

// Automatic mock doesn't work because the import in the module causes error when in a testing environment
jest.mock('../../services/media', () => ({
  switchOnAudioInput: jest.fn(noOp),
  stopRecording: jest.fn(noOp),
  startRecording: jest.fn(noOp),
  audioBlobToWavArrayBuffer: jest.fn(noOp),
  createNewAudioGraph: jest.fn(noOp),
  playBlob: jest.fn(noOp),
  createOscillator: jest.fn(noOp),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  playAudioNode: jest.fn((node: AudioScheduledSourceNode | AudioNode) => {
    return new Promise(noOp);
  }),
  stopPlaying: jest.fn(noOp),
}));

jest.mock;

describe('recordingPage', () => {
  it('starts recording when r is pressed', async () => {
    expect.assertions(4);

    // Fix for 'Reference Error: __static is not defined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).__static = '';

    //Define mocks to confirm that calls have been made
    const alertStartRecording = jest.spyOn(mediaService, 'startRecording');
    const alertAudioBlobToWavArrayBuffer = jest.spyOn(mediaService, 'audioBlobToWavArrayBuffer');
    const stopRecording = jest.spyOn(mediaService, 'stopRecording');
    const switchOnAudio = jest.spyOn(mediaService, 'switchOnAudioInput');

    render(<RecordingPage onBack={noOp} recordingItems={[]} basePath={''} scaleKey={'C'} octave={2} />);
    //R is 82
    fireEvent.keyDown(document, { key: 'R', code: '82' });
    await new Promise((r) => setTimeout(r, 3000));
    fireEvent.keyUp(document, { key: 'R', code: '82' });

    expect(alertStartRecording).toHaveBeenCalledTimes(1);
    expect(alertAudioBlobToWavArrayBuffer).toHaveBeenCalledTimes(1);
    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(switchOnAudio).toHaveBeenCalledTimes(1);
  });

  it('plays a tone when s is pressed', async () => {
    expect.assertions(3);

    // Fix for 'Reference Error: __static is not defined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).__static = '';
    const audioContext = new AudioContext();
    const osc = audioContext.createOscillator();

    //Define mocks to confirm that calls have been made
    const createNewAudioGraph = jest.spyOn(mediaService, 'createNewAudioGraph');
    const createOscillator = mocked(mediaService.createOscillator);
    osc.start();
    createOscillator.mockReturnValue(osc);

    const playAudioNode = mocked(mediaService.playAudioNode);
    playAudioNode.mockResolvedValue(new Promise(noOp));

    const stopPlaying = mocked(mediaService.stopPlaying);
    stopPlaying.mockResolvedValue(new Promise(noOp));

    render(<RecordingPage onBack={noOp} recordingItems={[]} basePath={''} scaleKey={'C'} octave={2} />);
    //S is 83
    fireEvent.keyDown(document, { key: 'S', code: '83' });
    await new Promise((r) => setTimeout(r, 3000));
    fireEvent.keyUp(document, { key: 'S', code: '83' });

    expect(createNewAudioGraph).toHaveBeenCalledTimes(1);
    expect(createOscillator).toHaveBeenCalledTimes(1);
    expect(playAudioNode).toHaveBeenCalledTimes(1);
  });

  it('plays back when space is pressed', async () => {
    expect.assertions(3);

    // Fix for 'Reference Error: __static is not defined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).__static = '';

    //Define mocks to confirm that calls have been made
    const mediaMock = mocked(readWavAsBlob);
    mediaMock.mockResolvedValue(new Blob([new Uint8Array(new Buffer('Test'))]));

    const playBlob = mocked(mediaService.playBlob);
    playBlob.mockResolvedValue(new Promise(noOp));

    const stopPlaying = mocked(mediaService.stopPlaying);
    stopPlaying.mockResolvedValue(new Promise(noOp));

    render(
      <RecordingPage
        onBack={noOp}
        recordingItems={[{ fileSystemName: 'Test', displayText: 'TestText' }]}
        basePath={''}
        scaleKey={'C'}
        octave={2}
      />,
    );
    //Space is 32
    fireEvent.keyDown(document, { key: ' ', code: '32' });
    await new Promise((r) => setTimeout(r, 3000));
    fireEvent.keyUp(document, { key: ' ', code: '32' });

    expect(mediaMock).toHaveBeenCalledTimes(1);
    expect(playBlob).toHaveBeenCalledTimes(1);
    expect(stopPlaying).toHaveBeenCalledTimes(1);
  });
});
