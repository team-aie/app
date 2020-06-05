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
