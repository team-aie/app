/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * See fileTransformer.js example at {@link https://jestjs.io/docs/en/webpack#mocking-css-modules}.
 */

const path = require('path');

module.exports = {
  process: (src, filename, config) => {
    const { cwd } = config;
    const relativePath = path.relative(path.join(cwd, 'src'), filename);
    return `module.exports = ${JSON.stringify(relativePath)};`;
  },
};
