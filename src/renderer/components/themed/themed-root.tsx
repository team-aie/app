import React, { FC, useContext } from 'react';

import { LocaleContext } from '../../contexts';
import { LOCALE_TO_FONT_FAMILY } from '../../env-and-consts';

const ThemedRoot: FC = ({ children }) => {
  const { locale } = useContext(LocaleContext);
  const fontFamily = LOCALE_TO_FONT_FAMILY[locale];

  return (
    <div style={{ fontFamily: `${fontFamily}` }} className={locale.toLowerCase()}>
      {children}
    </div>
  );
};

export default ThemedRoot;
