import * as React from 'react';
import * as renderer from 'react-test-renderer';

import NextButton from '.';

describe('next button', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const tree = renderer.create(<NextButton onClick={(): void => {}} disabled />).toJSON();
    expect(tree).toMatchInlineSnapshot(`
      <button
        className="btn btn-outline-secondary"
        disabled={true}
        onClick={[Function]}
        style={
          Object {
            "bottom": "30px",
            "minWidth": "120px",
            "position": "absolute",
            "right": "30px",
          }
        }
        type="button"
      >
        Next
      </button>
    `);
  });
});
