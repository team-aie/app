import React, { FC, useContext } from 'react';

import { ThemeContext } from '../../contexts';

const StyleSwitcher: FC = () => {
  const { theme } = useContext(ThemeContext);
  const styleHref = `en-US/themes/${theme}.styles.css`;
  //const styleHref = `${theme}.styles.css`;
  return (
    <div>
      <link href={styleHref} rel={'stylesheet'} />
    </div>
  );
};

export default StyleSwitcher;
