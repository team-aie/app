import React from 'react';
import { create as createTree } from 'react-test-renderer';

import { TextButton } from './text-button';

describe('TextButton', () => {
  it('should render correctly', () => {
    expect.assertions(1);

    const tree = createTree(<TextButton onClick={jest.fn()}>Some text</TextButton>).toJSON();

    expect(tree).toMatchInlineSnapshot(`
      <button
        onClick={[MockFunction]}
        style={
          Object {
            "background": "none",
            "border": "none",
            "color": "inherit",
            "padding": 0,
          }
        }
      >
        Some text
      </button>
    `);
  });

  it('should allow overriding CSS styles that the component does and does not override', () => {
    expect.assertions(1);

    const tree = createTree(
      <TextButton style={{ background: 'blue', display: 'inline-block' }}>Some text</TextButton>,
    ).toJSON();

    expect(tree).toMatchInlineSnapshot(`
      <button
        style={
          Object {
            "background": "blue",
            "border": "none",
            "color": "inherit",
            "display": "inline-block",
            "padding": 0,
          }
        }
      >
        Some text
      </button>
    `);
  });
});
