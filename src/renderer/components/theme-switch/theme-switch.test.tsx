import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import * as SnapshotRenderer from 'react-test-renderer';
import { mocked } from 'ts-jest/utils';

import { SupportedTheme } from '../../types';

import { ThemeSwitch } from './theme-switch';

describe('ThemeSwitch', () => {
  let realUseContext: typeof React.useContext;

  beforeEach(() => {
    realUseContext = React.useContext;
    React.useContext = jest.fn();
  });

  afterEach(() => {
    React.useContext = realUseContext;
  });

  it('should render correctly', () => {
    expect.assertions(1);

    const useContextMock = mocked(React.useContext);
    useContextMock.mockReturnValueOnce({
      theme: SupportedTheme.LIGHT,
      setTheme: jest.fn(),
    });

    const tree = SnapshotRenderer.create(<ThemeSwitch />).toJSON();

    expect(tree).toMatchInlineSnapshot(`
      <button
        className="image-button"
        onClick={[Function]}
      >
        <img
          className=""
          src="renderer/components/theme-switch/to-dark-mode.svg"
          style={
            Object {
              "width": "2em",
            }
          }
        />
      </button>
    `);
  });

  it('should switch to dark mode when in light mode', async () => {
    expect.assertions(1);

    const useContextMock = mocked(React.useContext);
    const setThemeMock = jest.fn();
    useContextMock.mockReturnValueOnce({
      theme: SupportedTheme.LIGHT,
      setTheme: setThemeMock,
    });

    render(<ThemeSwitch />);
    userEvent.click(await screen.findByRole('button'));

    expect(setThemeMock).toHaveBeenCalledWith(SupportedTheme.DARK);
  });

  it('should switch to light mode when in dark mode', async () => {
    expect.assertions(1);

    const useContextMock = mocked(React.useContext);
    const setThemeMock = jest.fn();
    useContextMock.mockReturnValueOnce({
      theme: SupportedTheme.DARK,
      setTheme: setThemeMock,
    });

    render(<ThemeSwitch />);
    userEvent.click(await screen.findByRole('button'));

    expect(setThemeMock).toHaveBeenCalledWith(SupportedTheme.LIGHT);
  });
});
