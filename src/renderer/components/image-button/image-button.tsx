import React, { FC, MouseEventHandler } from 'react';
import Image from 'react-bootstrap/Image';

interface ImageButtonProps {
  onClick?: MouseEventHandler<HTMLElement>;
  src: string;
  width?: string;
  /**
   * Used to allow this element to be selected in react-testing-library testing.
   */
  testId?: string;
}

export const ImageButton: FC<ImageButtonProps> = ({ onClick, src, width, testId }) => {
  return (
    <button data-testid={testId} onClick={onClick} className={'image-button'}>
      <Image src={src} style={{ width }} />
    </button>
  );
};
