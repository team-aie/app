/* eslint-disable @typescript-eslint/no-var-requires */
const { join } = require('path');

module.exports = {
  root: false,
  extends: [
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:testing-library/recommended',
    'plugin:jest-dom/recommended',
    'plugin:jest/recommended',
    'plugin:jest/style',
    'plugin:jest-formatting/strict',
  ],
  plugins: ['react-hooks'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    jsx: true,
    // Cannot use purely relative path here.
    // See: https://github.com/typescript-eslint/typescript-eslint/issues/251#issuecomment-567365174.
    tsconfigRootDir: join(__dirname, '..'),
  },
  env: {
    browser: true,
    node: true,
    es2020: true,
    jest: true,
  },
  globals: {
    __static: true,
  },
  rules: {
    yoda: ['error', 'never', { exceptRange: true }],
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: false,
        },
      },
    ],
    'react/prop-types': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
