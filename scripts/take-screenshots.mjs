import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const outDir = path.resolve('./docs/ux/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Logging in...');
  await page.goto('http://localhost:8081/login');
  
  // Accept cookies if present
  try {
    const cookieButton = await page.locator('button:has-text("Aceptar")');
    if (await cookieButton.isVisible({ timeout: 2000 })) {
      await cookieButton.click();
    }
  } catch (e) {
    // Ignore
  }

  await page.fill('input[type="email"]', 'jlort1721@gmail.com');
  await page.fill('input[type="password"]', 'Jml1413031');
  
  // Check the data protection checkbox
  await page.locator('button[role="checkbox"]').click();

  await page.click('button[type="submit"]');

  // Wait for login to complete (either navigation or dashboard element)
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => console.log('Timeout waiting for dashboard URL, proceeding...'));

  // Handle tour if exists
  try {
    const skipTour = await page.locator('button:has-text("Omitir")').first();
    if (await skipTour.isVisible({ timeout: 2000 })) {
      await skipTour.click();
    }
  } catch (e) {
    // Ignore
  }

  const routes = [
    { name: 'dashboard', url: 'http://localhost:8081/dashboard' },
    { name: 'live-streams', url: 'http://localhost:8081/live-streams' },
    { name: 'live-view', url: 'http://localhost:8081/live-view' },
    { name: 'access-doors', url: 'http://localhost:8081/access-doors' },
    { name: 'devices', url: 'http://localhost:8081/devices' },
    { name: 'events', url: 'http://localhost:8081/events' },
  ];

  for (const route of routes) {
    console.log(`Navigating to ${route.name}...`);
    await page.goto(route.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Give it some extra time for animations/loading
    await page.screenshot({ path: path.join(outDir, `${route.name}.png`) });
    console.log(`Saved screenshot for ${route.name}`);
  }

  await browser.close();
  console.log('Done!');
})();
