import { test, expect } from '@playwright/test';
test('access doors', async ({ page }) => {
  await page.goto('/access-doors');
  await expect(page.locator('text=Acceso').first()).toBeVisible();
});
