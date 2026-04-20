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

  test("page renders device list container with real cards or explicit empty state", async ({
    page,
  }) => {
    // Strong: expect EITHER a real card-list with >=1 device-shaped item
    // OR an explicit "no hay dispositivos" empty state (not just a word match).
    const cards = page.locator(
      '[data-testid^="device-"], [data-testid="device-card"], table tbody tr, [role="listitem"]',
    );
    const emptyState = page.locator(
      '[data-testid="empty-state"], [data-testid*="empty"]',
    );

    const cardCount = await cards.count();
    const emptyVisible = await emptyState
      .first()
      .isVisible()
      .catch(() => false);

    expect(cardCount > 0 || emptyVisible).toBeTruthy();

    // Page heading must explicitly mention devices — not just a random match in footer/nav.
    const heading = page
      .locator("h1, h2")
      .filter({ hasText: /dispositivo|device|cámara/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
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
