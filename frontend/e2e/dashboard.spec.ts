/**
 * Dashboard loads against production (bundle index-BGMh9jIt.js, last
 * deployed 2026-04-17). G4 features (KPI cards, AI panel) ship with B3.2.
 */
import { test, expect } from "@playwright/test";
import { requireAuth } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await requireAuth(page);
  });

  test("page loads without fatal error", async ({ page }) => {
    const html = await page.locator("body").textContent();
    expect(html?.length ?? 0).toBeGreaterThan(100);
  });

  test("page title reflects brand", async ({ page }) => {
    await expect(page).toHaveTitle(/Clave Seguridad|AION/);
  });

  test("sidebar nav to core sections present", async ({ page }) => {
    const nav = page
      .locator('a[href*="/live-streams"], a[href*="/devices"]')
      .first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test.skip("G4: 4 KPI cards (deferred to B3.2)", async ({ page }) => {
    const cards = page.locator('[data-testid="kpi-card"]');
    await expect(cards).toHaveCount(4);
  });

  test.skip("G4: AI + PM2 widgets (deferred)", async ({ page }) => {
    await expect(page.locator('[data-testid="ai-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="pm2-status"]')).toBeVisible();
  });
});
