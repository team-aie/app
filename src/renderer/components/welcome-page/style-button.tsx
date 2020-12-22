import React, { FC, useContext } from 'react';
import Image from 'react-bootstrap/Image';

import { ThemeContext } from '../../contexts';
import { SupportedTheme } from '../../types';

import switchButton from './styleSwitchButton.svg';

const StyleButton: FC = () => {
  // const { locale, setLocale } = useContext(LocaleContext);
  // console.log('locale is: ' + locale);
  const { theme, setTheme } = useContext(ThemeContext);
  // setLocale(locale as SupportedLocale);
  const styleHref = `en-US/themes/${theme}.styles.css`;
  //const styleHref = `${theme}.styles.css`;
  return (
    <div>
      <Image
        onClick={(): void => {
          //setTheme('dark' as SupportedTheme);
          if (theme == 'light') {
            setTheme('dark' as SupportedTheme);
            // console.log('changed theme is: ' + theme);
            // console.log('changed styleHref is:' + styleHref);
          } else {
            setTheme('light' as SupportedTheme);
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
