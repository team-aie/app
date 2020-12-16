import * as React from 'react';
import * as renderer from 'react-test-renderer';

import backButton from './back-button.svg';

import ImageButton from '.';

describe('imageButton', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

    const tree = renderer.create(<ImageButton src={backButton} width="1rem" />).toJSON();
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
        <button class="image-button">
          <img
            src="test-file-stub"
            class=""
            style={
              Object {
                "width": "1rem",
              }
            }
          >
        </button>
      </div>
    `);
  });
});
