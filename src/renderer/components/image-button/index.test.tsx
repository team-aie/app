import * as React from 'react';
import * as renderer from 'react-test-renderer';

import backButton from './back-button.svg';

import ImageButton from '.';

describe('imageButton', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

    const tree = renderer.create(<ImageButton src={backButton} width="1rem" />).toJSON();

    expect(tree).toMatchInlineSnapshot(`
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
    `);
  });
});
