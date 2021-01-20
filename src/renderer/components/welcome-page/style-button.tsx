import React, { FC, useContext } from 'react';
import Image from 'react-bootstrap/Image';

import { LocaleContext, ThemeContext } from '../../contexts';
import { SupportedTheme } from '../../types';

import switchButton from './styleSwitchButton.svg';

const StyleButton: FC = () => {
  const { locale } = useContext(LocaleContext);
  const { theme, setTheme } = useContext(ThemeContext);
  const styleHref = `${locale}/themes/${theme}.styles.css`;
  return (
    <div>
      <Image
        onClick={(): void => {
          if (theme === SupportedTheme.LIGHT) {
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
