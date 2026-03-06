import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig, devices } from '@playwright/test';

config({ path: resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,

  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://ghostly-production.up.railway.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Setup: run login first
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // Public tests (no auth needed)
    {
      name: 'public',
      testMatch: /\/(landing|waitlist)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Security tests (no auth — uses fresh context)
    {
      name: 'security',
      testMatch: /auth-security\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },

    // Authenticated tests (depend on setup)
    {
      name: 'authenticated',
      testMatch: /\/(auth|dashboard|events|expenses|categories|contacts|team|documents|settings|admin|app-shell|roi|export|import|file-upload|webhooks|integrations|calendar|edge-cases|api)\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/user.json',
      },
    },
  ],
});
