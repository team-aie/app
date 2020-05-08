import * as React from 'react';
import * as renderer from 'react-test-renderer';

import NextButton from '.';

describe('next button', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const tree = renderer.create(<NextButton onClick={(): void => {}} disabled />).toJSON();
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
});
