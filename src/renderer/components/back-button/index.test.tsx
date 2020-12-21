import * as React from 'react';
import * as renderer from 'react-test-renderer';

import BackButton from '.';

describe('back button', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

    const tree = renderer.create(<BackButton />).toJSON();
    expect(tree).toMatchInlineSnapshot(`
      <div
        className="position-absolute p-0 d-flex justify-content-start align-items-center container"
        style={
          Object {
            "left": "1.5rem",
            "top": "1.5rem",
          }
        }
      >
        <button
          className="image-button"
        >
          <img
            className=""
            src="test-file-stub"
            style={
              Object {
                "width": "1rem",
              }
            }
          />
        </button>
      </div>
    `);
  });
});
