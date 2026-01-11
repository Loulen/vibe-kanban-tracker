import { defineConfig } from '@playwright/test';
import path from 'path';

const extensionPath = path.join(__dirname, 'dist');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Extension tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60000,

  use: {
    trace: 'on-first-retry',
    video: 'on-first-retry',
    baseURL: 'http://localhost:3069',
  },

  projects: [
    {
      name: 'firefox-extension',
      use: {
        browserName: 'firefox',
        launchOptions: {
          firefoxUserPrefs: {
            'extensions.autoDisableScopes': 0,
            'xpinstall.signatures.required': false,
          },
        },
      },
    },
  ],

  // Web server for running vibe-kanban locally during tests (optional)
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3069',
  //   reuseExistingServer: !process.env.CI,
  // },
});
