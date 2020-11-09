import React, { FC, MouseEventHandler, useContext } from 'react';
import Image from 'react-bootstrap/Image';

import { LocaleContext } from '../../contexts';

const ImageButton: FC<{ onClick?: MouseEventHandler<HTMLElement>; img: string; passedWidth: string }> = ({
  onClick,
  img,
  passedWidth,
}) => {
  const { locale, setLocale } = useContext(LocaleContext);
  return (
    <button
      onClick={onClick}
      className={locale.substring(locale.length - 4) == 'dark' ? 'image-button-dark' : 'image-button'}>
      <Image src={img} style={{ width: passedWidth }} />
    </button>
  );
};

export default ImageButton;
