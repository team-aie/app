'use strict';

{
  // Move TextEncoder and TextDecoder into the global scope, just like in a browser (in `window`).
  const { TextEncoder, TextDecoder } = require('util');

  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Fix for 'Reference Error: __static is not defined
global.__static = '__static';

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

{
  // Always mock @electron/remote here to prevent loading electron files just because `src/render/utils` is imported.
  // If mock behaviors are needed, manually mock in the test.
  // `jest` is defined.
  // eslint-disable-next-line no-undef
  jest.mock('@electron/remote', () => ({}));
}

{
  // JSDom has not implemented navigator.mediaDevices yet.
  const { createMediaDevices } = require('./src/fakes/media-devices');

  // TODO: Do not recreate on every `navigator.mediaDevices` access. Move to `beforeEach` and/or `afterEach`.
  // `navigator` is defined.
  // eslint-disable-next-line no-undef
  Object.defineProperty(navigator, 'mediaDevices', { get: createMediaDevices });
}
