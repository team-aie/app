import React from 'react';
import renderer, { create as createTree } from 'react-test-renderer';

import { noOp } from '../../../common/env-and-consts';

import { NextButton } from './next-button';

describe('NextButton', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

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

  it('should be clicked once', () => {
    expect.hasAssertions();

    const mockFunction = jest.fn();
    const tree = renderer.create(<NextButton onClick={mockFunction} disabled />);
    tree.root.props.onClick();

    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});
