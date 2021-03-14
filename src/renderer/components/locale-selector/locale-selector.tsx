import React, { CSSProperties, FC, useContext } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';

import { SUPPORTED_LOCALES } from '../../../common/env-and-consts';
import { LocaleContext, ThemeContext } from '../../contexts';
import { SupportedLocale, SupportedTheme } from '../../types';

export const LocaleSelector: FC<{ fontSize?: CSSProperties['fontSize'] }> = ({ fontSize }) => {
  const { locale, setLocale } = useContext(LocaleContext);
  const { theme } = useContext(ThemeContext);

  const fontColor = theme === SupportedTheme.LIGHT ? 'var(--dark)' : 'var(--light)';

  return (
    <Dropdown drop={'up'}>
      <Dropdown.Toggle
        as={'a'}
        href={'#'}
        className={theme === SupportedTheme.LIGHT ? 'alert-light' : 'alert-dark'}
        id={'dropdown-toggle'}
        style={{ fontSize }}>
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
            <Dropdown.Item key={i} active={isCurrentLocale} onClick={switchLocale} style={{ color: fontColor }}>
              {supportedLocale}
            </Dropdown.Item>
          );
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default LocaleSelector;
