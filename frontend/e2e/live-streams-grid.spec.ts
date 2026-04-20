import { test, expect } from '@playwright/test';
test('live streams grid', async ({ page }) => {
  await page.goto('/live-streams');
  await expect(page.locator('text=Video').first()).toBeVisible();
});
