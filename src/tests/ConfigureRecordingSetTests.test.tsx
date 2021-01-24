/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable jest/prefer-expect-assertions */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import ConfigureRecordingSetPage from '../renderer/components/configure-recording-set-page/index';
import { RecordingSet } from '../renderer/types';

const flushPromises = () => new Promise(setImmediate);

describe('configureRecordingSetPage', () => {
  it('renders without showDetails button', async () => {
    const originalError = console.error;
    console.error = (...args: string[]) => {
      if (/Warning.*not wrapped in act/.test(args[0])) {
        return;
      }
      originalError.call(console, ...args);
    };
    render(
      <ConfigureRecordingSetPage
        onNext={(_event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
        onBack={(_event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
        onSetSelected={(_consumer: RecordingSet) => {}}
      />,
    );
    let imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(4);
    await flushPromises();
    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(4);
    console.error = originalError;
  });

  it('renders showDetails butten when reclist is selected', async () => {
    const originalError = console.error;
    console.error = (...args: string[]) => {
      if (/Warning.*not wrapped in act/.test(args[0])) {
        return;
      }
      originalError.call(console, ...args);
    };
    render(
      <ConfigureRecordingSetPage
        onNext={(_event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
        onBack={(_event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
        onSetSelected={(_consumer: RecordingSet) => {}}
      />,
    );
    let imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(4);
    const recListDropdown = screen.getAllByTestId('test')[0];
    await waitFor(() => {
      fireEvent.change(recListDropdown, { target: { value: 'デルタ式英語リストver5 (Delta English Ver. 5)' } });
    });
    await flushPromises();

    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(5);
    console.error = originalError;
  });

  it('renders oto.ini page after showDetails button is clicked', async () => {
    const originalError = console.error;
    console.error = (...args: string[]) => {
      if (/Warning.*not wrapped in act/.test(args[0])) {
        return;
      }
      originalError.call(console, ...args);
    };
    render(
      <ConfigureRecordingSetPage
        onNext={(_event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
        onBack={(_event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
        onSetSelected={(_consumer: RecordingSet) => {}}
      />,
    );
    await flushPromises();

    let imageButtons = screen.getAllByRole('button');
    const recListDropdown = screen.getAllByTestId('test')[0];
    await waitFor(() => {
      fireEvent.change(recListDropdown, { target: { value: 'デルタ式英語リストver5 (Delta English Ver. 5)' } });
    });
    await flushPromises();

    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(5);
    const showDetailsButton = imageButtons[3];
    fireEvent.click(showDetailsButton);
    await flushPromises();

    const header = screen.getAllByText('Oto.ini');
    expect(header).toBeDefined();

    console.error = originalError;
  });
});
