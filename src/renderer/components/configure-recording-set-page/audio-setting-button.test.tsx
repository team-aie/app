import React from 'react';
import { create as createTree } from 'react-test-renderer';

import { AudioSettingButton } from './audio-setting-button';

describe('AudioSettingButton', () => {
  it('should render correctly', () => {
    expect.assertions(1);

    const tree = createTree(<AudioSettingButton onClick={jest.fn()} />).toJSON();

    expect(tree).toMatchInlineSnapshot(`
      <button
        className="image-button"
        onClick={[MockFunction]}
      >
        <img
          className=""
          src="renderer/components/configure-recording-set-page/audio-setting-button-light.svg"
          style={
            Object {
              "width": "2em",
            }
          }
        />
      </button>
    `);
  });
});
