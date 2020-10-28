import React, { FC, useContext } from 'react';

import { LocaleContext } from '../../contexts';
import { SupportedLocale } from '../../types';

const StyleSwitcher: FC = () => {
  const { locale, setLocale } = useContext(LocaleContext);
  const styleHref = `${locale}.styles.css`;

  return (
    // <div>
    //   const switchMode = (): void => {
    //     styleHref = `${locale}-dark.styles.css`;
    //     console.log(styleHref);
    //   };

    // return (
    <div>
      <button
        onClick={(): void => {
          console.log('mode is: ' + locale.substring(locale.length - 4));
          if (locale.substring(locale.length - 4) == 'dark') {
            console.log('locale is: ' + locale.substring(0, locale.length - 5));
            setLocale(locale.substring(0, locale.length - 5) as SupportedLocale);
          } else {
            setLocale(`${locale}-dark` as SupportedLocale);
          }
          console.log(locale);
        }}>
        Switch Mode
      </button>
      <link href={styleHref} rel={'stylesheet'} />
    </div>
  );
  return (
    <div>
      <link href={styleHref} rel={'stylesheet'} />
    </div>
  );
};

export default StyleSwitcher;
