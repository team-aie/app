'use strict';

{
  // This is a polyfill to match Node's implementation with Chromium's, we will not need them after we update to Node 14
  const { TextEncoder, TextDecoder } = require('util');

  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

{
  // `jest` is defined.
  // eslint-disable-next-line no-undef
  jest.mock('react-i18next', () => ({
    // This mock makes sure any components using the translate hook can use it without a warning being shown.
    useTranslation: () => {
      return {
        t: (str) => str,
        i18n: {
          changeLanguage: () => new Promise(() => {}),
        },
      };
    },
  }));
}
