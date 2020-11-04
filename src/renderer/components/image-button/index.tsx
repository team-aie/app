import React, { FC, MouseEventHandler } from 'react';
import Image from 'react-bootstrap/Image';

const ImageButton: FC<{ onClick?: MouseEventHandler<HTMLElement>; img: string; passedWidth: string }> = ({
  onClick,
  img,
  passedWidth,
}) => {
  return (
    <button onClick={onClick} className="image-button">
      <Image src={img} style={{ width: passedWidth }} />
    </button>
  );
};

export default ImageButton;
