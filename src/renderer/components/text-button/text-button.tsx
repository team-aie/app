import React, { FC, HTMLAttributes } from 'react';

type TextButtonProps = HTMLAttributes<HTMLButtonElement>;

/**
 * A button that styles just like a text-displaying element.
 */
export const TextButton: FC<TextButtonProps> = ({ children, style = {}, ...props }) => {
  return (
    <button
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'inherit',
        ...style,
      }}
      {...props}>
      {children}
    </button>
  );
};
