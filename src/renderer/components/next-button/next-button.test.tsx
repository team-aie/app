import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { create as createTree } from 'react-test-renderer';

import { noOp } from '../../../common/env-and-consts';

import { NextButton } from './next-button';

describe('NextButton', () => {
  it('should render correctly', () => {
    expect.assertions(1);

    const tree = createTree(<NextButton onClick={noOp()} disabled />).toJSON();

    expect(tree).toMatchInlineSnapshot(`
      <div
        className="position-absolute p-0 d-flex justify-content-end align-items-center container"
        style={
          Object {
            "bottom": "1.5rem",
            "right": "1.5rem",
          }
        }
      >
        <button
          className="btn btn-outline-secondary"
          disabled={true}
          onClick={[Function]}
          style={
            Object {
              "minWidth": "120px",
            }
          }
          type="button"
        >
          Next
        </button>
      </div>
    `);
  });

  it('should be clicked once', async () => {
    expect.assertions(1);

    const mockFunction = jest.fn();
    render(<NextButton onClick={mockFunction} disabled={false} />);

    userEvent.click(await screen.findByText('Next'));

    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});
