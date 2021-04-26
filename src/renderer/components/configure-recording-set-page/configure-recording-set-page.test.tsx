import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/extend-expect';
import React from 'react';
import { noop } from 'rxjs';
import { mocked } from 'ts-jest/utils';

import recordingListDataService from '../../services/recording-list-data-service';
import { openFilePicker } from '../../utils';

import { ConfigureRecordingSetPage } from './configure-recording-set-page';

jest.mock('../../services/recording-list-data-service');
// Mock the remote module to prevent import failure.
jest.mock('@electron/remote', () => ({ dialog: jest.fn() }));
jest.mock('../../utils', () => ({
  ...jest.requireActual('../../utils'),
  openFilePicker: jest.fn().mockImplementation(),
}));

describe('ConfigureRecordingSetPage', () => {
  it('renders without showDetails button', async () => {
    expect.assertions(2);

    render(<ConfigureRecordingSetPage onSettingsButtonClick={noop} onNext={noop} onBack={noop} onSetSelected={noop} />);

    expect(screen.queryByTestId('show-details-button')).toBeFalsy();
    expect(recordingListDataService.readData).not.toHaveBeenCalled();
  });

  it('renders showDetails butten when built in reclist is selected', async () => {
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
  });

  it('removes showDetails butten when reclist is deselected', async () => {
    expect.assertions(2);

    const readDataMock = mocked(recordingListDataService.readData);
    readDataMock.mockResolvedValue({
      listContent: 'listContent',
      recordingItems: [],
      otoIni: 'otoIni',
      voiceDvcfg: 'voiceDvcfg',
    });

    render(<ConfigureRecordingSetPage onSettingsButtonClick={noop} onNext={noop} onBack={noop} onSetSelected={noop} />);

    userEvent.selectOptions(screen.getByTestId('selectReclist'), 'デルタ式英語リストver5 (Delta English Ver. 5)');

    await screen.findByTestId('show-details-button');

    expect(recordingListDataService.readData).toHaveBeenCalledWith({
      type: 'built-in',
      name: 'デルタ式英語リストver5 (Delta English Ver. 5)',
    });

    userEvent.selectOptions(screen.getByTestId('selectReclist'), '');

    expect(screen.queryByTestId('show-details-button')).toBeFalsy();
  });

  it('renders list preview page after showDetails button is clicked', async () => {
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

    userEvent.click(await screen.findByTestId('up-button'));
  });

  it('renders oto.ini and dvcfg pages after next button is clicked', async () => {
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

    userEvent.click(await screen.findByTestId('next-button'));
    await screen.findByText('otoIni');

    userEvent.click(await screen.findByTestId('next-button'));
    await screen.findByText('voiceDvcfg');

    expect(recordingListDataService.readData).toHaveBeenCalledTimes(1);

    userEvent.click(await screen.findByTestId('up-button'));
  });

  it('returns from list-preview page to main page when up is clicked', async () => {
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

    userEvent.click(await screen.findByTestId('up-button'));
    await screen.findByTestId('show-details-button');

    expect(recordingListDataService.readData).toHaveBeenCalledTimes(1);
  });

  it('renders showDetails butten when custom reclist is selected', async () => {
    expect.assertions(3);

    const readDataMock = mocked(recordingListDataService.readData);
    readDataMock.mockResolvedValue({
      listContent: 'listContent',
      recordingItems: [],
      otoIni: 'otoIni',
      voiceDvcfg: 'voiceDvcfg',
    });
    const mockedFilePick = mocked(openFilePicker);
    // Use of 'any' is required since method is overridden, and the default signature has a different return type than the one we're testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedFilePick.mockResolvedValue('testReclist' as any);

    render(<ConfigureRecordingSetPage onSettingsButtonClick={noop} onNext={noop} onBack={noop} onSetSelected={noop} />);
    //Confirm no selected default reclist and no button

    userEvent.selectOptions(screen.getByTestId('selectReclist'), '');

    expect(screen.queryByTestId('show-details-button')).toBeFalsy();

    // Click filepicker
    userEvent.click(await screen.findByTestId('cust-list-button'));

    expect(recordingListDataService.readData).toHaveBeenCalledTimes(1);
    expect(openFilePicker).toHaveBeenCalledTimes(1);

    await screen.findByTestId('show-details-button');
  });
});
