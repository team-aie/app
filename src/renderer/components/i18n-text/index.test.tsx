import * as React from 'react';
import * as renderer from 'react-test-renderer';

import { i18n } from '../../services/i18n';
import { Locale } from '../../types/i18n';

import I18nText from '.';

describe('i18nText', () => {
  it('should respond to language changes', () => {
    expect.hasAssertions();

    i18n.register({
      'test.key': {
        [Locale.ZH_CN]: '测试值',
        [Locale.EN_US]: 'Test value',
      },
    });
    const treeCn = renderer.create(<I18nText i18nKey={'test.key'} locale={Locale.ZH_CN} />).toJSON();
    expect(treeCn).toMatchInlineSnapshot(`"测试值"`);

    const treeEn = renderer.create(<I18nText i18nKey={'test.key'} locale={Locale.EN_US} />).toJSON();
    expect(treeEn).toMatchInlineSnapshot(`"Test value"`);
  });
});
