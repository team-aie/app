import React from 'react';
import { create as createTree } from 'react-test-renderer';

import backButton from './__test_resources__/back-button.svg';

import ImageButton from '.';

describe('ImageButton', () => {
  it('should render correctly', () => {
    expect.assertions(1);

    const tree = createTree(<ImageButton src={backButton} width="1rem" />).toJSON();

    expect(tree).toMatchInlineSnapshot(`
      <button
        className="image-button"
      >
        <img
          className=""
          src="renderer/components/image-button/__test_resources__/back-button.svg"
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
