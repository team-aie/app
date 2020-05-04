import * as React from 'react';
import * as renderer from 'react-test-renderer';

import BackButton from '.';

describe('back button', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

    const tree = renderer.create(<BackButton />).toJSON();
    expect(tree).toMatchInlineSnapshot(`
      <img
        className=""
        src="test-file-stub"
        style={
          Object {
            "left": "1.5rem",
            "position": "absolute",
            "top": "1.5rem",
            "width": "1rem",
          }
        }
      />
    `);
  });
});
