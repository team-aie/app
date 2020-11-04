import React, { FC, useContext } from 'react';
import Image from 'react-bootstrap/Image';

import { LocaleContext } from '../../contexts';
import { SupportedLocale } from '../../types';

import switchButton from './styleSwitchButton.svg';

const StyleButton: FC = () => {
  const { locale, setLocale } = useContext(LocaleContext);
  const styleHref = `${locale}.styles.css`;
  return (
    <div>
      <Image
        onClick={(): void => {
          if (locale.substring(locale.length - 4) == 'dark') {
            setLocale(locale.substring(0, locale.length - 5) as SupportedLocale);
          } else {
            setLocale(`${locale}-dark` as SupportedLocale);
          }
        }}
        src={switchButton}
        style={{ width: '2rem' }}
      />
      <link href={styleHref} rel={'stylesheet'} />
    </div>
  );
};

export default StyleButton;
