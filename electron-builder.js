'use strict';

const isCi = process.env.CI === 'true';
const isFastPackaging = process.env.FAST_PACKAGING === 'true';

const compression = isFastPackaging || !isCi ? 'store' : 'maximum';
// eslint-disable-next-line no-console
console.info(`Compression level: ${compression}`);

module.exports = {
  appId: 'com.team-aie.app',
  copyright: 'Copyright © 2020 ${author}',
  asar: true,
  compression,
  files: [
    '**/*',
    // According to doc, some default ignored files are automatically added, so we only need to add our ignores
    '!node_modules/node-source-han-sans',
    '!node_modules/node-source-han-sans-sc',
    '!node_modules/semantic-ui-css',
  ],
  mac: {
    identity: null,
    target: [
      {
        target: 'dmg',
        arch: 'x64',
      },
      {
        target: 'zip',
        arch: 'x64',
      },
    ],
  },
  dmg: {
    format: 'ULFO',
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: 'x64',
      },
      {
        target: 'zip',
        arch: 'x64',
      },
    ],
  },
  nsis: {
    artifactName: '${productName}-setup-${version}.${ext}',
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    uninstallDisplayName: '${productName}',
    menuCategory: true,
    oneClick: true,
    perMachine: false,
    packElevateHelper: false,
    allowElevation: false,
    deleteAppDataOnUninstall: true,
  },
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: 'x64',
      },
      {
        target: 'zip',
        arch: 'x64',
      },
    ],
    category: 'Audio',
  },
  appImage: {
    artifactName: '${productName}.${ext}',
  },
};
