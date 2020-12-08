import React, { FC, MouseEventHandler } from 'react';
import Image from 'react-bootstrap/Image';

interface ImageButtonProps {
  onClick?: MouseEventHandler<HTMLElement>;
  src: string;
  passedWidth: string;
}

const ImageButton: FC<ImageButtonProps> = ({ onClick, src, passedWidth }) => {
  return (
    <button onClick={onClick} className={'image-button'}>
      <Image src={src} style={{ width: passedWidth }} />
    </button>
  );
};

export default ImageButton;
