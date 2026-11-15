import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  fullyParallel: false,
  workers: 1,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list'
});
