import React, { FC, useContext } from 'react';

import { LocaleContext } from '../../contexts';

const StyleSwitcher: FC = () => {
  const { locale } = useContext(LocaleContext);
  const styleHref = `${locale}.styles.css`;
  return (
    <div>
      <link href={styleHref} rel={'stylesheet'} />
    </div>
  );
};

export default StyleSwitcher;
