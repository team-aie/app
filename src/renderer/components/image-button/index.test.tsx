import React from 'react';
import { create as createTree } from 'react-test-renderer';

import backButton from './back-button.svg';

import ImageButton from '.';

describe('imageButton', () => {
  it('should render correctly', () => {
    expect.hasAssertions();

    const tree = createTree(<ImageButton src={backButton} width="1rem" />).toJSON();

    expect(tree).toMatchInlineSnapshot(`
      <button
        className="image-button"
      >
        <img
          className=""
          src="renderer/components/image-button/back-button.svg"
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
