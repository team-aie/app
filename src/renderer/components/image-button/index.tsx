import React, { FC, MouseEventHandler } from 'react';
import Image from 'react-bootstrap/Image';

interface ImageButtonProps {
  onClick?: MouseEventHandler<HTMLElement>;
  img: string;
  passedWidth: string;
}
const ImageButton: FC<ImageButtonProps> = ({ onClick, img, passedWidth }) => {
  return (
    <button onClick={onClick} className={'image-button'}>
      <Image src={img} style={{ width: passedWidth }} />
    </button>
  );
};

export default ImageButton;
