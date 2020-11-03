import React, { FC, MouseEventHandler } from 'react';
import { Button } from 'react-bootstrap';
import Image from 'react-bootstrap/Image';

const ImageButton: FC<{ onClick?: MouseEventHandler<HTMLElement>; img: string }> = ({ onClick, img }) => {
  return (
    <Button onClick={onClick} variant={'outline-secondary'} className="highlightButton">
      <Image src={img} style={{ width: '1rem' }} />
    </Button>
  );
};

export default ImageButton;
