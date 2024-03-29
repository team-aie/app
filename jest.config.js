'use strict';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  collectCoverageFrom: ['**/*.{ts,tsx}', '!**/*.d.ts', '!dist/**'],
  /**
   * See `fileTransformer.js` example at {@link https://jestjs.io/docs/en/webpack#mocking-css-modules}.
   */
  transform: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/src/jest-file-transformer.js',
    '\\.(css|scss)$': '<rootDir>/src/jest-file-transformer.js',
  },
  // FIXME This un-ignore pattern is not quite working. The tests works because of manual mocking.
  transformIgnorePatterns: ['/node_modules/?!(wavesurfer.js)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  resetMocks: true,
  resetModules: true,
  restoreMocks: true,
};
