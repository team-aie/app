import React, { FC, useContext } from 'react';

import { LocaleContext, ThemeContext } from '../../contexts';

const StyleSwitcher: FC = () => {
  const { theme } = useContext(ThemeContext);
  const { locale } = useContext(LocaleContext);
  const styleHref = `${locale}/themes/${theme}.styles.css`;
  //const styleHref = `${theme}.styles.css`;
  return (
    <div>
      <link href={styleHref} rel={'stylesheet'} />
    </div>
  );
};

export default StyleSwitcher;
