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

  test("events page loads with domain vocabulary", async ({ page }) => {
    const body = await page.locator("body").textContent();
    expect(body).toMatch(/evento|alarm|incident|notific/i);
  });

  test("list container or empty-state rendered", async ({ page }) => {
    const anyContent = page.locator(
      'ul, ol, [role="list"], [data-testid="empty-state"], [data-testid="alarm-row"]',
    );
    await expect(anyContent.first()).toBeVisible({ timeout: 10_000 });
  });
});
