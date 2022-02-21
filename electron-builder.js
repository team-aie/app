/* eslint-disable no-console */
'use strict';

const isCi = process.env.CI === 'true';
console.info('isCi:', isCi);
const isLinuxOnlyBuild = process.argv.includes('-l');
console.info('isLinuxOnlyBuild:', isLinuxOnlyBuild);

const compression = isLinuxOnlyBuild || !isCi ? 'store' : 'maximum';
console.info(`Compression level: ${compression}`);

module.exports = {
  appId: 'com.team-aie.app',
  copyright: 'Copyright © 2022 ${author}',
  asar: true,
  compression,
  files: [
    '**/*',
    // According to doc, some default ignored files are automatically added, so we only need to add our ignores
  ],
  mac: {
    identity: null,
    target: [
      {
        target: 'dmg',
        arch: 'x64',
      },
      {
        target: 'dmg',
        arch: 'arm64',
      },
      {
        target: 'dmg',
        arch: 'universal',
      },
      {
        target: 'zip',
        arch: 'x64',
      },
      {
        target: 'zip',
        arch: 'arm64',
      },
      {
        target: 'zip',
        arch: 'universal',
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
