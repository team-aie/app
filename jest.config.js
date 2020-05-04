'use strict';

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
};
