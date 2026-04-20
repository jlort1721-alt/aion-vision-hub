/**
 * /events page — alarms/events feed renders.
 */
import { test, expect } from "@playwright/test";
import { requireAuth } from "./helpers";

test.describe("Events / Alarms", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/events");
    await requireAuth(page);
  });

  test("events page has heading and feed region", async ({ page }) => {
    // Strong: explicit heading (not random body match) + a feed/list region.
    const heading = page
      .locator("h1, h2")
      .filter({ hasText: /evento|alarm|incident|notific/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const feedRegion = page
      .locator(
        '[data-testid="events-feed"], [data-testid="alarms-feed"], [role="feed"], main [role="list"]',
      )
      .first();
    await expect(feedRegion).toBeVisible();
  });

  test("list container or empty-state rendered", async ({ page }) => {
    const anyContent = page.locator(
      'ul, ol, [role="list"], [data-testid="empty-state"], [data-testid="alarm-row"]',
    );
    await expect(anyContent.first()).toBeVisible({ timeout: 10_000 });
  });
});
