import React, { FC, useContext } from 'react';
import { Dropdown } from 'semantic-ui-react';

import { LocaleContext } from '../../contexts';
import { SUPPORTED_LOCALES, SupportedLocale } from '../../types';

import 'semantic-ui-css/components/dropdown.min.css';

const LocaleSelector: FC = () => {
  const { locale, setLocale } = useContext(LocaleContext);

  const localeOptions = [...SUPPORTED_LOCALES].map((supportedLocale) => ({
    key: supportedLocale,
    text: supportedLocale,
    value: supportedLocale,
  }));

  return (
    <Dropdown
      fluid
      selection
      options={localeOptions}
      value={locale}
      onChange={(e, { value }): void => {
        setLocale(value as SupportedLocale);
      }}
    />
  );
};

export default LocaleSelector;
