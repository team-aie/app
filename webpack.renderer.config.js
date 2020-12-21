'use strict';

const fs = require('fs');
const path = require('path');

/**
 * For {@link https://webpack.js.org/plugins/mini-css-extract-plugin/#extracting-css-based-on-entry}.
 */
function recursiveIssuer(m) {
  if (m.issuer) {
    return recursiveIssuer(m.issuer);
  } else if (m.name) {
    return m.name;
  } else {
    return false;
  }
}

module.exports = (config) => {
  {
    /**
     * For {@link https://github.com/electron-userland/electron-webpack/issues/361}.
     */
    config.externals = [...config.externals, 'react', 'react-dom'];
  }

  {
    /**
     * For {@link https://webpack.js.org/plugins/mini-css-extract-plugin/#extracting-css-based-on-entry}.
     */
    const localeDirs = fs
      .readdirSync(path.join(__dirname, 'src/locales'), { withFileTypes: true })
      .filter((file) => file.isDirectory())
      .map((file) => file.name);

    let { entry = {} } = config;
    let cacheGroups = {};
    localeDirs.forEach((localeDir) => {
      entry = {
        ...entry,
        [localeDir]: path.join(__dirname, 'src/locales', localeDir, 'index.scss'),
      };
      cacheGroups = {
        ...cacheGroups,
        [localeDir]: {
          name: localeDir,
          test: (m, c, entry = localeDir) => m.constructor.name === 'CssModule' && recursiveIssuer(m) === entry,
          chunks: 'all',
          enforce: true,
        },
      };
    });

    config.entry = entry;
    config.optimization = {
      splitChunks: { cacheGroups },
    };

    const mcePlugin = config.plugins.find((plugin) => plugin.options && plugin.options.filename === 'styles.css');
    mcePlugin.options.filename = '[name].styles.css';

    /**
     * See {@link https://github.com/jantimon/html-webpack-plugin#options}.
     */
    const hwPlugin = config.plugins.find((plugin) => plugin.options && plugin.options.filename === 'index.html');
    hwPlugin.options.chunks = ['renderer'];
  }

  {
    /**
     * For raw-loader. See {@link https://webpack.electron.build/modifying-webpack-configurations#configure-raw-loader}.
     */
    config.module.rules.push({
      test: /\.txt$/,
      use: 'raw-loader',
    });
  }

  return config;
};
