import React, { FC, MouseEventHandler } from 'react';
import { Button } from 'react-bootstrap';
import Image from 'react-bootstrap/Image';

const ImageButton: FC<{ onClick?: MouseEventHandler<HTMLElement>; img: string; passedWidth: string }> = ({
  onClick,
  img,
  passedWidth,
}) => {
  return (
    <Button onClick={onClick} className="image-button">
      <Image src={img} style={{ width: passedWidth }} />
    </Button>
  );
};

export default ImageButton;
