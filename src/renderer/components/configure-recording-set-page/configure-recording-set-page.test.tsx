import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/extend-expect';
import React from 'react';
import { noop } from 'rxjs';
import { mocked } from 'ts-jest/utils';

import recordingListDataService from '../../services/recording-list-data-service';

import { ConfigureRecordingSetPage } from './configure-recording-set-page';

jest.mock('../../services/recording-list-data-service');
// Mock the remote module to prevent import failure.
jest.mock('@electron/remote', () => ({ dialog: jest.fn() }));

const mockedFilePicker = jest.fn();

describe('ConfigureRecordingSetPage', () => {
  it('renders without showDetails button', async () => {
    expect.assertions(2);

    render(
      <ConfigureRecordingSetPage
        onSettingsButtonClick={noop}
        onNext={noop}
        onBack={noop}
        onSetSelected={noop}
        openFilePicker={mockedFilePicker}
      />,
    );

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

    render(
      <ConfigureRecordingSetPage
        onSettingsButtonClick={noop}
        onNext={noop}
        onBack={noop}
        onSetSelected={noop}
        openFilePicker={mockedFilePicker}
      />,
    );

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

    render(
      <ConfigureRecordingSetPage
        onSettingsButtonClick={noop}
        onNext={noop}
        onBack={noop}
        onSetSelected={noop}
        openFilePicker={mockedFilePicker}
      />,
    );

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

    render(
      <ConfigureRecordingSetPage
        onSettingsButtonClick={noop}
        onNext={noop}
        onBack={noop}
        onSetSelected={noop}
        openFilePicker={mockedFilePicker}
      />,
    );

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

    render(
      <ConfigureRecordingSetPage
        onSettingsButtonClick={noop}
        onNext={noop}
        onBack={noop}
        onSetSelected={noop}
        openFilePicker={mockedFilePicker}
      />,
    );

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

    render(
      <ConfigureRecordingSetPage
        onSettingsButtonClick={noop}
        onNext={noop}
        onBack={noop}
        onSetSelected={noop}
        openFilePicker={mockedFilePicker}
      />,
    );

    userEvent.selectOptions(screen.getByTestId('selectReclist'), 'デルタ式英語リストver5 (Delta English Ver. 5)');
    userEvent.click(await screen.findByTestId('show-details-button'));

    await screen.findByText('listContent');

    userEvent.click(await screen.findByTestId('up-button'));
    await screen.findByTestId('show-details-button');

    expect(recordingListDataService.readData).toHaveBeenCalledTimes(1);
  });

  it('renders showDetails butten when custom reclist is selected', async () => {
    expect.assertions(2);

    const readDataMock = mocked(recordingListDataService.readData);
    readDataMock.mockResolvedValue({
      listContent: 'listContent',
      recordingItems: [],
      otoIni: 'otoIni',
      voiceDvcfg: 'voiceDvcfg',
    });

    const mockedFilePicker = jest.fn().mockReturnValue('testReclist');

    render(
      <ConfigureRecordingSetPage
        onSettingsButtonClick={noop}
        onNext={noop}
        onBack={noop}
        onSetSelected={noop}
        openFilePicker={mockedFilePicker}
      />,
    );
    //Confirm no selected default reclist and no button

    userEvent.selectOptions(screen.getByTestId('selectReclist'), '');

    expect(screen.queryByTestId('show-details-button')).toBeFalsy();

    // Click filepicker
    userEvent.click(await screen.findByTestId('cust-list-button'));

    expect(mockedFilePicker).toHaveBeenCalledTimes(1);

    // Expect(recordingListDataService.readData).toHaveBeenCalledTimes(1);

    await screen.findByTestId('show-details-button');
  });
});
