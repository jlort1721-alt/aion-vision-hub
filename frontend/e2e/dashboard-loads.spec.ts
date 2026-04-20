import { test, expect } from '@playwright/test';
test('dashboard loads', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('text=Panel').first()).toBeVisible();
});
