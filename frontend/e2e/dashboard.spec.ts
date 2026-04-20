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
    // Strong check: no Vite error overlay, no "Error"/"500" in title,
    // and the #root (or main content) has actually rendered children.
    const errorOverlay = page.locator(
      "vite-error-overlay, #__vite_plugin_react_preamble_error_overlay",
    );
    await expect(errorOverlay).toHaveCount(0);

    const title = await page.title();
    expect(title).not.toMatch(/Error|500|Something went wrong/i);

    const root = page.locator("#root, main, [role=main]").first();
    await expect(root).toBeVisible({ timeout: 10_000 });
    const childrenCount = await root.locator(":scope > *").count();
    expect(childrenCount).toBeGreaterThan(0);
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
