import { test, expect } from '@playwright/test';
test('alarms feed', async ({ page }) => {
  await page.goto('/events');
  await expect(page.locator('text=Eventos').first()).toBeVisible();
});
