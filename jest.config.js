'use strict';

// This is a polyfill to match Node's implementation with Chromium's, we will not need them after we update to Node 14
const { TextEncoder, TextDecoder } = require('text-decoding');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  /**
   * See {@link https://jestjs.io/docs/en/webpack#handling-static-assets}.
   */
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/src/__mocks__/fileMock.ts',
    '\\.(css|scss)$': '<rootDir>/src/__mocks__/styleMock.ts',
  },
  globals: {
    TextEncoder,
    TextDecoder,
  },
};
