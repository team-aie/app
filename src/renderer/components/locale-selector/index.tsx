import React, { CSSProperties, FC, useContext } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';

import { LocaleContext } from '../../contexts';
import { SUPPORTED_LOCALES } from '../../env-and-consts';
import { SupportedLocale } from '../../types';

const LocaleSelector: FC<{ fontSize?: CSSProperties['fontSize'] }> = ({ fontSize }) => {
  const { locale, setLocale } = useContext(LocaleContext);

  return (
    <Dropdown drop={'up'}>
      <Dropdown.Toggle as={'a'} href={'#'} className={'alert-light'} id={'dropdown-toggle'} style={{ fontSize }}>
        {locale}
      </Dropdown.Toggle>

      <Dropdown.Menu style={{ fontSize, minWidth: 0 }}>
        {[...SUPPORTED_LOCALES].map((supportedLocale, i) => {
          const isCurrentLocale = locale === supportedLocale;
          const switchLocale = (): void => {
            if (!isCurrentLocale) {
              setLocale(supportedLocale as SupportedLocale);
            }
          };
          return (
            <Dropdown.Item key={i} active={isCurrentLocale} onClick={switchLocale}>
              {supportedLocale}
            </Dropdown.Item>
          );
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default LocaleSelector;
