import React, { FC, useContext } from 'react';
import Image from 'react-bootstrap/Image';

import { LocaleContext, ThemeContext } from '../../contexts';
import { SupportedTheme } from '../../types';

import switchButton from './styleSwitchButton.svg';

const StyleButton: FC = () => {
  // const { locale, setLocale } = useContext(LocaleContext);
  // console.log('locale is: ' + locale);
  const { theme, setTheme } = useContext(ThemeContext);
  const { locale } = useContext(LocaleContext);
  // setLocale(locale as SupportedLocale);
  const styleHref = `${locale}/themes/${theme}.styles.css`;
  //const styleHref = `${theme}.styles.css`;
  return (
    <div>
      <Image
        onClick={(): void => {
          if (theme == 'light') {
            setTheme(SupportedTheme.DARK);
          } else {
            setTheme(SupportedTheme.LIGHT);
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
