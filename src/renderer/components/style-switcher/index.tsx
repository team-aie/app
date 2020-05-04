import React, { FC, useContext } from 'react';

import { LocaleContext } from '../../contexts';

const StyleSwitcher: FC = () => {
  const { locale } = useContext(LocaleContext);
  const styleHref = `${locale}.styles.css`;

  return <link href={styleHref} rel={'stylesheet'} />;
};

export default StyleSwitcher;
