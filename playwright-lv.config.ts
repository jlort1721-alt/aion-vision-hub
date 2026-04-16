import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: process.env.AION_BASE_URL ?? "https://aionseg.co",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: false,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "liveview",
      testMatch: /live-view-pro/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
