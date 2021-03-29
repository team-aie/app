'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const LicensePlugin = require('webpack-license-plugin');
const { execFile } = require('child_process');

const WAIT_FOR_OTHERS_SECONDS = 10;

/**
 * This config aims to allow webpack-license-plugin to load all licenses and save to {@code src/renderer/licenses.ts}.
 */
module.exports = async (env) => {
  const [mainConfig, rendererConfig, licenseConfig] = await Promise.all([
    require('electron-webpack/webpack.main.config')(env),
    require('electron-webpack/webpack.renderer.config')(env),
    // Config to get license collected. Based on the renderer process config.
    require('electron-webpack/webpack.renderer.config')(env),
  ]);

  const licenseInfos = new Set();

  licenseConfig.externals = [];
  licenseConfig.target = 'node';
  licenseConfig.entry = {
    license: [...Object.values(mainConfig.entry).flat(1), ...Object.values(rendererConfig.entry).flat(1)],
  };
  licenseConfig.output = { ...licenseConfig.output };
  licenseConfig.output.path = licenseConfig.output.path.replace('renderer', 'license');
  licenseConfig.plugins = [
    ...licenseConfig.plugins,
    new LicensePlugin({
      licenseOverrides: {
        // https://github.com/streamich/fast-shallow-equal/tree/1.0.0#license
        'fast-shallow-equal@1.0.0': 'Unlicense',
        // https://github.com/streamich/nano-css/blob/v5.3.0/LICENSE
        'nano-css@5.3.1': 'Unlicense',
        // https://github.com/streamich/react-universal-interface/tree/v0.6.2/LICENSE
        'react-universal-interface@0.6.2': 'Unlicense',
        // FIXME: These recording list "packages" must be assigned a license in order for build to run.
        'delta_eng_ver5@1.0.0': 'GPL-3.0-only',
        'z.cvvc_normal@1.1.0': 'GPL-3.0-only',
      },
      // This file is ignored because it's not very reliable
      outputFilename: '_oss_licenses.json',
      replenishDefaultLicenseTexts: true,
      additionalFiles: {
        /**
         * We found that due to multiple entry points, the plugin generates the file multiple times at the same file
         * location, overwriting previous entries' results. Therefore, we use it as a hook and are collecting the
         * metadata manually.
         */
        _hook: (packages) => {
          // eslint-disable-next-line no-console
          console.info(`[LicensePlugin] Custom hook called to add ${packages.length} package license meta`);
          packages.map((x) => JSON.stringify(x)).forEach((x) => licenseInfos.add(x));
          // We do not need to actually populate this file
          return '';
        },
      },
    }),
    {
      apply: (compiler) => {
        const licenseTsFolder = path.join(__dirname, 'src', 'renderer');
        const licenseTsPath = path.join(licenseTsFolder, 'licenses.ts');
        const licenseTsTemplatePath = path.join(licenseTsFolder, 'licenses.ts.base');

        const writeLicenseTsFile = async (content) => {
          const template = String(await fsp.readFile(licenseTsTemplatePath));
          const fileContent = template.replace('__LICENSE_CONTENT_HERE__', JSON.stringify(content));

          await fsp.writeFile(licenseTsPath, fileContent);

          return new Promise((resolve, reject) => {
            // Use prettier to format the JSON string into prettier TypeScript.
            execFile('npx', ['prettier', '-w', licenseTsPath], (err, stdout, stderr) => {
              if (stdout) {
                process.stdout.write(stdout);
              }
              if (stderr) {
                process.stderr.write(stderr);
              }

              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        };

        compiler.hooks.beforeRun.tapPromise('CleanLicenseTsPlugin', async () => {
          return writeLicenseTsFile([
            // Just a placeholder value to work with compilation
            {
              name: 'electron',
              version: '8.2.3',
              author: 'Electron Community',
              repository: null,
              source: 'https://registry.npmjs.org/electron/-/electron-8.2.3.tgz',
              license: 'MIT',
              licenseText: 'Copyright (c) 2013-2019 GitHub Inc.',
            },
          ]);
        });

        compiler.hooks.afterEmit.tap('CopyLicenseTsPlugin', () => {
          // eslint-disable-next-line no-console
          console.info(`Waiting ${WAIT_FOR_OTHERS_SECONDS} seconds to ensure all plugins have run`);
          setTimeout(() => {
            // eslint-disable-next-line no-console
            console.info('Writing package license meta to file');
            writeLicenseTsFile([...licenseInfos].map(JSON.parse).sort((a, b) => (a.name > b.name ? 1 : -1))).catch(
              // eslint-disable-next-line no-console
              console.error,
            );
          }, WAIT_FOR_OTHERS_SECONDS * 1000);
        });
      },
    },
  ];

  return licenseConfig;
};
