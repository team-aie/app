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
    await new Promise((r) => setTimeout(r, 2000));
    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(5);
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
    // console.log(imageButtons);
    const recListDropdown = screen.getAllByTestId('test')[0];
    await waitFor(() => {
      fireEvent.change(recListDropdown, { target: { value: 'デルタ式英語リストver5 (Delta English Ver. 5)' } });
    });
    await new Promise((r) => setTimeout(r, 2000));
    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(5);
    console.error = originalError;
  });
  // });
});
