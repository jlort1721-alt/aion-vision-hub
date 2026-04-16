// test/e2e/playwright.config.ts
//
// End-to-end tests for the reverse-connect feature. Runs against a
// disposable AION stack spun up by docker-compose.test.yml alongside
// the Dahua + Hikvision simulators.
//
//   pnpm exec playwright install chromium
//   pnpm exec playwright test --config test/e2e/playwright.config.ts
//
// In CI these run after `make test-int` succeeds.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test/e2e/report' }],
    ['junit', { outputFile: 'test/e2e/junit.xml' }],
  ],
  use: {
    baseURL: process.env.AION_E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm --filter @aion/web dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
