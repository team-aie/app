/* eslint-disable no-console */
'use strict';

const isCi = process.env.CI === 'true';
console.info('isCi:', isCi);
const isLinuxOnlyBuild = process.argv.includes('-l');
console.info('isLinuxOnlyBuild:', isLinuxOnlyBuild);

const compression = isLinuxOnlyBuild || !isCi ? 'store' : 'maximum';
console.info(`Compression level: ${compression}`);

// We need this because with config file, electron-builder cannot specify arch from CLI.
const includeX64 = process.argv.includes('--x64');
const includeArm64 = process.argv.includes('--arm64');
const includeUniversal = process.argv.includes('--universal');
console.info('includeX64:', includeX64, 'includeArm64:', includeArm64, 'includeUniversal:', includeUniversal);

const getMacOsTarget = () => {
  const X64_FRAGMENT = [
    {
      target: 'dmg',
      arch: 'x64',
    },
    {
      target: 'zip',
      arch: 'x64',
    },
  ];
  const ARM64_FRAGMENT = [
    {
      target: 'dmg',
      arch: 'arm64',
    },
    {
      target: 'zip',
      arch: 'arm64',
    },
  ];
  const UNIVERSAL_FRAGMENT = [
    {
      target: 'dmg',
      arch: 'universal',
    },
    {
      target: 'zip',
      arch: 'universal',
    },
  ];

  if (!includeX64 && !includeArm64 && !includeUniversal) {
    return [...X64_FRAGMENT, ...ARM64_FRAGMENT, ...UNIVERSAL_FRAGMENT];
  }

  return [
    ...(includeX64 ? X64_FRAGMENT : []),
    ...(includeArm64 ? ARM64_FRAGMENT : []),
    ...(includeUniversal ? UNIVERSAL_FRAGMENT : []),
  ];
};

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
    target: getMacOsTarget(),
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
