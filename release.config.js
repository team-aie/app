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
                { path: 'dist/*.zip' },
                { path: 'dist/*.dmg' },
                { path: 'dist/*.exe' },
                { path: 'dist/*.AppImage' },
                { path: 'dist/*.yml' },
                { path: 'dist/*.blockmap' },
              ],
            },
          ],
        ],
      }),
};
