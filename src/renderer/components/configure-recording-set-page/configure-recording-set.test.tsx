import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/extend-expect';
import React from 'react';
import { noop } from 'rxjs';
import { mocked } from 'ts-jest/utils';

import recordingListDataService from '../../services/recording-list-data-service';

import ConfigureRecordingSetPage from './index';

jest.mock('../../services/recording-list-data-service');

describe('ConfigureRecordingSetPage', () => {
  it('renders without showDetails button', async () => {
    expect.assertions(2);

    render(<ConfigureRecordingSetPage onSettingsButtonClick={noop} onNext={noop} onBack={noop} onSetSelected={noop} />);

    expect(screen.queryByTestId('show-details-button')).toBeFalsy();
    expect(recordingListDataService.readData).not.toHaveBeenCalled();
  });

  it('renders showDetails butten when reclist is selected', async () => {
    expect.assertions(2);

    const readDataMock = mocked(recordingListDataService.readData);
    readDataMock.mockResolvedValue({
      listContent: 'listContent',
      recordingItems: [],
      otoIni: 'otoIni',
      voiceDvcfg: 'voiceDvcfg',
    });

    render(<ConfigureRecordingSetPage onSettingsButtonClick={noop} onNext={noop} onBack={noop} onSetSelected={noop} />);

    expect(screen.queryByTestId('show-details-button')).toBeFalsy();

    userEvent.selectOptions(screen.getByTestId('selectReclist'), 'デルタ式英語リストver5 (Delta English Ver. 5)');

    await screen.findByTestId('show-details-button');

    expect(recordingListDataService.readData).toHaveBeenCalledWith({
      type: 'built-in',
      name: 'デルタ式英語リストver5 (Delta English Ver. 5)',
    });

    readDataMock.mockReset();
  });

  it('renders list preview page after showDetails button is clicked and then goes to list preview page', async () => {
    expect.assertions(1);

    const readDataMock = mocked(recordingListDataService.readData);
    readDataMock.mockResolvedValue({
      listContent: 'listContent',
      recordingItems: [],
      otoIni: 'otoIni',
      voiceDvcfg: 'voiceDvcfg',
    });

    render(<ConfigureRecordingSetPage onSettingsButtonClick={noop} onNext={noop} onBack={noop} onSetSelected={noop} />);
    userEvent.selectOptions(screen.getByTestId('selectReclist'), 'デルタ式英語リストver5 (Delta English Ver. 5)');
    userEvent.click(await screen.findByTestId('show-details-button'));

    await screen.findByText('listContent');

    expect(recordingListDataService.readData).toHaveBeenCalledTimes(1);

    readDataMock.mockReset();
  });
});
