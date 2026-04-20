/**
 * /devices page — basic rendering check against production.
 */
import { test, expect } from "@playwright/test";
import { requireAuth } from "./helpers";

test.describe("Devices", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/devices");
    await requireAuth(page);
  });

  test("page loads with device list or empty-state", async ({ page }) => {
    const body = await page.locator("body").textContent();
    expect(body).toMatch(/dispositivo|device|cámara|camera/i);
  });

  test("nav links back to other sections", async ({ page }) => {
    const homeLink = page
      .locator('a[href="/"], a[href="/dashboard"], a[href*="live-streams"]')
      .first();
    await expect(homeLink).toBeVisible({ timeout: 10_000 });
  });

  test.skip("41 device cards render (deferred to B3.2)", async ({ page }) => {
    const cards = page.locator('[data-testid="device-card"]');
    await expect(cards).toHaveCount(41);
  });
});
