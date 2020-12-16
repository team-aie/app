import * as React from 'react';
import * as renderer from 'react-test-renderer';

import backButton from './back-button.svg';
import ImageButton from '.';

describe('ImageButton', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

    const tree = renderer.create(<ImageButton src={backButton} width="1rem"/>).toJSON();
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
          <img
            className=""
            src="test-file-stub"
            style={
              Object {
                "width": "1rem",
              }
            }
          />
        />
      </div>
    `);
  });
});
