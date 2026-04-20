import { test, expect } from '@playwright/test';
test('devices page', async ({ page }) => {
  await page.goto('/devices');
  await expect(page.locator('text=Dispositivos').first()).toBeVisible();
});
