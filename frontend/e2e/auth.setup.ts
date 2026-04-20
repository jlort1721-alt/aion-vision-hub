import { test as setup, expect } from '@playwright/test';
const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_USER || 'jlort1721@gmail.com');
  await page.fill('input[type="password"]', process.env.TEST_PASS || 'Jml1413031');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: authFile });
});
