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
  dmg: {
    format: 'ULFO',
  },
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
  nsis: {
    artifactName: '${productName}-setup-${version}.${ext}',
    uninstallDisplayName: '${productName}',
    menuCategory: true,
    oneClick: false,
    perMachine: true,
    packElevateHelper: true,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: true,
  },
  appImage: {
    artifactName: '${productName}.${ext}',
  },
};
