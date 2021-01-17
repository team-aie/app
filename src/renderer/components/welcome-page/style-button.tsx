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
  console.log('start!');
  //const styleHref = `${theme}.styles.css`;
  return (
    <div>
      <Image
        onClick={(): void => {
          console.log('What is theme?');
          if (theme == 'light') {
            console.log('It is light');
            setTheme(SupportedTheme.DARK as SupportedTheme);
          } else {
            console.log('It is dark');
            setTheme(SupportedTheme.LIGHT as SupportedTheme);
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
