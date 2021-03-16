'use strict';

const isCi = process.env.CI === 'true';

module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  env: {
    node: true,
    es2020: true,
  },
  rules: {
    'capitalized-comments': [
      'error',
      'always',
      {
        ignorePattern: 'noinspection',
        ignoreConsecutiveComments: true,
      },
    ],
    eqeqeq: ['error', 'always'],
    // TODO: This is needed because prettier does not format code comments. Remove after it does.
    // See also: https://github.com/prettier/prettier/issues/265.
    'max-len': ['error', { code: 120 }],
    'no-console': isCi ? 'error' : 'warn',
    'no-debugger': isCi ? 'error' : 'warn',
    'object-shorthand': ['error', 'always'],
    'one-var': ['error', 'never'],
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      },
    ],
    strict: ['error', 'safe'],
  },
};
