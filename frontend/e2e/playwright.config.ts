import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for aionseg.co e2e.
 *
 * Defaults to production. Override with PLAYWRIGHT_BASE_URL=http://localhost:4173
 * for local bundle testing after `pnpm build && pnpm preview`.
 *
 * Auth flow:
 *   1. `setup` project runs auth.setup.ts once → stores session in e2e/.auth/user.json
 *   2. chromium project reuses that session via storageState
 *
 * Specs fall into two groups:
 *   - Public (no auth): pwa-manifest, dashboard public pages
 *   - Authenticated: dashboard, live-streams, devices, access-doors, events
 */
export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://aionseg.co",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      testIgnore: /pwa-manifest\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      // Public specs run without storageState (faster, no auth).
      name: "chromium-public",
      testMatch: /pwa-manifest\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
