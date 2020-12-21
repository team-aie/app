import React, { FC, MouseEventHandler } from 'react';
import Image from 'react-bootstrap/Image';

interface ImageButtonProps {
  onClick?: MouseEventHandler<HTMLElement>;
  src: string;
  width: string;
}

const ImageButton: FC<ImageButtonProps> = ({ onClick, src, width }) => {
  return (
    <button onClick={onClick} className={'image-button'}>
      <Image src={src} style={{ width }} />
    </button>
  );
};

export default ImageButton;
