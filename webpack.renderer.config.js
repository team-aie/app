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

  //     const themeDirs = fs
  //       .readdirSync(path.join(__dirname, 'src/locales/en-US/themes'), { withFileTypes: true })
  //       .filter((file) => file.isDirectory())
  //       .map((file) => file.name);

  //     let { entry = {} } = config;
  //     let cacheGroups = {};
  //     localeDirs.forEach((localeDir) => {
  //       themeDirs.forEach((themeDir) => {
  //         entry = {
  //           ...entry,
  //           [themeDir]: path.join(__dirname, 'src/locales', localeDir, 'themes', themeDir, 'index.scss'),
  //         };
  //         cacheGroups = {
  //           ...cacheGroups,
  //           [localeDir]: {
  //             name: localeDir,
  //             test: (m, c, entry = localeDir) => m.constructor.name === 'CssModule' && recursiveIssuer(m) === entry,
  //             chunks: 'all',
  //             enforce: true,
  //           },
  //         };
  //       });
  //     });

  //     config.entry = entry;
  //     config.optimization = {
  //       splitChunks: { cacheGroups },
  //     };

  //     const mcePlugin = config.plugins.find((plugin) => plugin.options && plugin.options.filename === 'styles.css');
  //     mcePlugin.options.filename = '[name]/themes/dark.styles.css';

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
    console.log('start');
    localeDirs.forEach((localeDir) => {
      const themeDirs = fs
        .readdirSync(path.join(__dirname, 'src/locales', localeDir, 'themes'), { withFileTypes: true })
        .filter((file) => file.isDirectory())
        .map((file) => file.name);
      console.log('this is ' + path.join(__dirname, 'src/locales', localeDir, 'themes'));
      themeDirs.forEach((theme) => {
        entry = {
          ...entry,
          [`${localeDir}/themes/${theme}`]: path.join(
            __dirname,
            'src/locales',
            localeDir,
            'themes',
            theme,
            'index.scss',
          ),
        };
        cacheGroups = {
          ...cacheGroups,
          [`${localeDir}/themes/${theme}`]: {
            name: `${localeDir}/themes/${theme}`,
            test: (m, c, entry = `${localeDir}/themes/${theme}`) =>
              m.constructor.name === 'CssModule' && recursiveIssuer(m) === entry,
            chunks: 'all',
            enforce: true,
          },
        };
      });
    });

    config.entry = entry;
    config.optimization = {
      splitChunks: { cacheGroups },
    };

    const mcePlugin = config.plugins.find((plugin) => plugin.options && plugin.options.filename === 'styles.css');
    mcePlugin.options.filename = '[name].styles.css';

    // const styleHref = `${locale}/themes/${theme}.styles.css`;

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
