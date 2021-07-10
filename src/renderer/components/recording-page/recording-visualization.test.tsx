import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import React from 'react';
import { mocked } from 'ts-jest/utils';
import WaveSurfer from 'wavesurfer.js';

import { RecordingVisualization } from './recording-visualization';

jest.mock('wavesurfer.js', () => ({
  create: jest.fn().mockReturnValue({
    destroy: jest.fn(),
  }),
}));
jest.mock('wavesurfer.js/src/plugin/microphone', () => ({
  create: jest.fn(),
}));
jest.mock('wavesurfer.js/src/plugin/spectrogram', () => ({
  create: jest.fn(),
}));

// Mock the remote module to prevent import failure.
jest.mock('@electron/remote', () => ({ dialog: jest.fn() }));

describe('RecordingVisualization', () => {
  it('creates a WaveSurfer instance on render', async () => {
    expect.assertions(1);

    const createMock = mocked(WaveSurfer.create);

    render(<RecordingVisualization prevState="idle" state="idle" filePath="" basePath="" recordingItemName="" />);

    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
