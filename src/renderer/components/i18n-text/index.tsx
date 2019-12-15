import React, { Fragment, ReactElement } from 'react';

import { i18n } from '../../services/i18n';
import { Locale } from '../../types/i18n';

interface TranslatedTextProps {
  i18nKey: string;
  locale: Locale;
}

const I18nText = ({ i18nKey, locale }: TranslatedTextProps): ReactElement => {
  return <Fragment>{i18n.getTranslation(i18nKey, locale)}</Fragment>;
};

export default I18nText;
