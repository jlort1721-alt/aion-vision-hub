/**
 * Live Streams grid — basic rendering against production. G5 features
 * (modal fullscreen, fuzzy search, layout persistence, hls.js) ship B3.2.
 */
import { test, expect } from "@playwright/test";
import { requireAuth } from "./helpers";

test.describe("Live Streams", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/live-streams");
    await requireAuth(page);
  });

  test("grid page renders at least one slot", async ({ page }) => {
    const slots = page.locator('video, [role="region"] [class*="grid"] > *');
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });
  });

  test("page has a video/stream grid region with rendered cells", async ({
    page,
  }) => {
    // Strong: expect a real layout — a grid container with at least one
    // data-testid or video element, plus a heading/header for the section.
    const gridContainer = page
      .locator(
        '[data-testid="stream-grid"], [class*="grid"]:has(video), main [role="region"]',
      )
      .first();
    await expect(gridContainer).toBeVisible({ timeout: 15_000 });

    const cells = gridContainer.locator(
      ":scope > *, [data-testid^='stream-'], video",
    );
    expect(await cells.count()).toBeGreaterThanOrEqual(1);

    // Page also has a visible section heading (h1/h2/h3 that mentions
    // en vivo/streams/sitios).
    const heading = page
      .locator("h1, h2, h3")
      .filter({ hasText: /en vivo|stream|sitio|puesto|video/i })
      .first();
    await expect(heading).toBeVisible();
  });

  test.skip("G5: fullscreen modal on stream dblclick (deferred)", async ({
    page,
  }) => {
    await page.locator('[data-testid^="stream-card"]').first().dblclick();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test.skip("G5: fuzzy search filters (deferred)", async ({ page }) => {
    await page.locator('input[type="search"]').first().fill("danub");
    const visible = page.locator('[data-testid^="stream-card"]:visible');
    expect(await visible.count()).toBeGreaterThan(0);
  });

  test.skip("G5: layout persists to localStorage (deferred)", async ({
    page,
  }) => {
    await page.locator('[data-testid="layout-toggle-9"]').first().click();
    const stored = await page.evaluate(() =>
      localStorage.getItem("aion-live-streams-selection"),
    );
    expect(stored).toBeTruthy();
  });
});
