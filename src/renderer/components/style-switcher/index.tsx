import React, { FC, useContext } from 'react';
import Image from 'react-bootstrap/Image';

import { LocaleContext } from '../../contexts';
import { SupportedLocale } from '../../types';

import switchButton from './styleSwitchButton.svg';

const StyleSwitcher: FC = () => {
  const { locale } = useContext(LocaleContext);
  const styleHref = `${locale}.styles.css`;
  return (
    <div>
      <link href={styleHref} rel={'stylesheet'} />
    </div>
  );
};
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
  return (
    <div>
      <link href={styleHref} rel={'stylesheet'} />
    </div>
  );
};

export { StyleSwitcher };
export { StyleButton };
