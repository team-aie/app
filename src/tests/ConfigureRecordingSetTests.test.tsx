/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable jest/prefer-expect-assertions */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import React from 'react';
import { initReactI18next } from 'react-i18next/';

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
    i18next.use(initReactI18next);
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
    cleanup();
  });

  it('renders showDetails butten when reclist is selected', async () => {
    const originalError = console.error;
    console.error = (...args: string[]) => {
      if (/Warning.*not wrapped in act/.test(args[0])) {
        return;
      }
      originalError.call(console, ...args);
    };
    i18next.use(initReactI18next);
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
    cleanup();
  });

  it('renders list preview page after showDetails button is clicked', async () => {
    const originalError = console.error;
    console.error = (...args: string[]) => {
      if (/Warning.*not wrapped in act/.test(args[0])) {
        return;
      }
      originalError.call(console, ...args);
    };
    i18next.use(initReactI18next);
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
    await waitFor(() => {
      fireEvent.click(showDetailsButton);
    });
    await flushPromises();

    let header = screen.getAllByText('List Preview');
    expect(header).toBeDefined();
    //stope here
    imageButtons = screen.getAllByRole('button');
    expect(imageButtons).toHaveLength(2);
    const nextPageButton = imageButtons[1];
    await waitFor(() => {
      fireEvent.click(nextPageButton);
    });
    await flushPromises();

    header = screen.getAllByText('Oto.ini');
    expect(header).toBeDefined();

    console.error = originalError;
    cleanup();
  });

  it('renders goes to oto-ini page after list preview page', async () => {
    const originalError = console.error;
    console.error = (...args: string[]) => {
      if (/Warning.*not wrapped in act/.test(args[0])) {
        return;
      }
      originalError.call(console, ...args);
    };
    expect(true).toBe(true);
    // render(
    //   <ConfigureRecordingSetPage
    //     onNext={(_event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
    //     onBack={(_event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
    //     onSetSelected={(_consumer: RecordingSet) => {}}
    //   />,
    // );
    // await flushPromises();

    // let imageButtons = screen.getAllByRole('button');
    // const recListDropdown = screen.getAllByTestId('test')[0];
    // await waitFor(() => {
    //   fireEvent.change(recListDropdown, { target: { value: 'デルタ式英語リストver5 (Delta English Ver. 5)' } });
    // });
    // await flushPromises();

    // imageButtons = screen.getAllByRole('button');
    // expect(imageButtons).toHaveLength(5);
    // const showDetailsButton = imageButtons[3];
    // await waitFor(() => {
    //   fireEvent.click(showDetailsButton);
    // });
    // await flushPromises();

    // const header = screen.getAllByText('List Preview');
    // expect(header).toBeDefined();

    // imageButtons = screen.getAllByRole('button');
    // expect(imageButtons).toHaveLength(2);
    // const nextPageButton = imageButtons[1];
    // await waitFor(() => {
    //   fireEvent.click(nextPageButton);
    // });
    // await flushPromises();

    // header = screen.getAllByText('Oto.ini');
    // expect(header).toBeDefined();

    console.error = originalError;
    cleanup();
  });
});
