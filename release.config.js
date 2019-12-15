'use strict';

const calculateVersionOnly = process.env.CALCULATE_VERSION_ONLY === 'true';

module.exports = {
  branches: [
    {
      name: 'master',
    },
  ],
  ...(calculateVersionOnly
    ? { plugins: ['@semantic-release/commit-analyzer'], dryRun: true }
    : {
        plugins: [
          '@semantic-release/commit-analyzer',
          '@semantic-release/release-notes-generator',
          ['@semantic-release/npm', { npmPublish: false }],
          '@semantic-release/git',
          [
            '@semantic-release/github',
            {
              assets: [
                { path: 'dist/*.zip', label: 'Packaged Zip File' },
                { path: 'dist/*.dmg', label: 'Packaged macOS App' },
                { path: 'dist/*.exe', label: 'Packaged Windows App' },
                { path: 'dist/*.AppImage', label: 'Packaged Linux App' },
                { path: 'dist/*.yml', label: 'AutoUpdate Metadata' },
                { path: 'dist/*.blockmap', label: 'AutoUpdate Blockmap' },
              ],
            },
          ],
        ],
      }),
};
