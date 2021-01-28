/**
 * @jest-environment jsdom
 */
/* eslint-disable no-console */
/* eslint-disable jest/prefer-expect-assertions */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { noop } from 'rxjs';

import ConfigureRecordingSetPage from './index';
const originalError = console.error;

const flushPromises = () => new Promise(setImmediate);
const beforeTest = () => {
  // Supresses compatibility issues with ReactDOM 16.8
  console.error = (...args: string[]) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalError.call(console, ...args);
  };
};
const afterTest = () => {
  console.error = originalError;
  cleanup();
};

describe('configureRecordingSetPage', () => {
  it('renders without showDetails button', async () => {
    beforeTest();
    render(<ConfigureRecordingSetPage onNext={noop} onBack={noop} onSetSelected={noop} />);
    let imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(4);
    await flushPromises();
    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(4);
    afterTest();
  });

  it('renders showDetails butten when reclist is selected', async () => {
    beforeTest();
    render(<ConfigureRecordingSetPage onNext={noop} onBack={noop} onSetSelected={noop} />);
    let imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(4);
    const recListDropdown = screen.getAllByTestId('selectReclist')[0];
    await waitFor(() => {
      fireEvent.change(recListDropdown, { target: { value: 'デルタ式英語リストver5 (Delta English Ver. 5)' } });
    });
    await flushPromises();

    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(5);
    afterTest();
  });

  it('renders list preview page after showDetails button is clicked and then goes to list preview page', async () => {
    beforeTest();
    render(<ConfigureRecordingSetPage onNext={noop} onBack={noop} onSetSelected={noop} />);
    await flushPromises();

    let imageButtons = screen.getAllByRole('button');
    const recListDropdown = screen.getAllByTestId('selectReclist')[0];
    await waitFor(() => {
      fireEvent.change(recListDropdown, { target: { value: 'デルタ式英語リストver5 (Delta English Ver. 5)' } });
    });
    await flushPromises();

    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(5);
    const showDetailsButton = imageButtons[3];
    await waitFor(() => {
      fireEvent.click(showDetailsButton);
      imageButtons = screen.getAllByRole('button');
      expect(imageButtons).toHaveLength(2);
    });

    afterTest();
  });
});
