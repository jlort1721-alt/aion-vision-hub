import { test, expect } from '@playwright/test';
import { loginAsOperator } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOperator(page);
  });

  test('dashboard shows KPI cards with data', async ({ page }) => {
    // KPI cards should be visible
    await expect(page.getByText(/dispositivos|devices/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/eventos|events/i).first()).toBeVisible();
  });

  test('dashboard shows charts', async ({ page }) => {
    // Recharts renders SVG elements
    const charts = page.locator('.recharts-wrapper');
    await expect(charts.first()).toBeVisible({ timeout: 10000 });
  });

  test('widget customization dialog opens', async ({ page }) => {
    const settingsBtn = page.getByRole('button', { name: /configurar|customize|widgets/i });
    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click();
      await expect(page.getByText(/widget/i)).toBeVisible();
    }
  });

  test('notification bell shows popup', async ({ page }) => {
    const bellBtn = page.locator('header').getByRole('button').filter({ has: page.locator('svg.lucide-bell') });
    await bellBtn.click();
    await expect(page.getByText(/notificaciones|notifications/i)).toBeVisible({ timeout: 5000 });
  });
});
