'use strict';

module.exports = {
  '*.{js,ts,tsx}': 'eslint --fix --cache --cache-location node_modules/.cache/.eslintcache',
  '*.scss': 'stylelint --fix',
  '*.md': 'prettier -w',
};
