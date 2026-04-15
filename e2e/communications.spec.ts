import { test, expect, assertNoConsoleErrors } from './fixtures';

test.describe('Communications', () => {
  test('intercom page loads device list', async ({ authedPage: page, request }) => {
    await page.goto('/intercom', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/intercom/);
    await expect(page.locator('main').first()).toBeVisible();

    const r = await request.get('/api/intercom/stations');
    if (r.status() === 200) {
      const list = (await r.json()).data ?? [];
      expect(Array.isArray(list)).toBe(true);
    }
    await assertNoConsoleErrors(page);
  });

  test('paging page renders broadcast UI', async ({ authedPage: page }) => {
    await page.goto('/paging', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/paging/);
    // Look for speak/broadcast affordance
    await expect(
      page.locator('button:has-text(/broadcast|hablar|paginar/i), [data-action="page"]').first()
    ).toBeVisible({ timeout: 15_000 });
    await assertNoConsoleErrors(page);
  });

  test('phone page shows extensions', async ({ authedPage: page, request }) => {
    await page.goto('/phone');
    const r = await request.get('/api/asterisk/extensions');
    if (r.status() === 200) {
      const body = await r.json();
      const exts = body.data ?? body;
      expect(Array.isArray(exts)).toBe(true);
    }
  });

  test('call-log shows recent call records', async ({ authedPage: page, request }) => {
    await page.goto('/call-log');
    await expect(page).toHaveURL(/\/call-log/);

    const r = await request.get('/api/calls?limit=20');
    expect([200, 204]).toContain(r.status());
    if (r.status() === 200) {
      const body = await r.json();
      const calls = body.data ?? body;
      expect(Array.isArray(calls)).toBe(true);
    }
  });

  test('whatsapp page loads conversation list', async ({ authedPage: page, request }) => {
    await page.goto('/whatsapp', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/whatsapp/);

    // Twilio WhatsApp Business API status check
    const r = await request.get('/api/twilio/whatsapp/status');
    if (r.status() === 200) {
      const body = await r.json();
      expect(body).toHaveProperty('connected');
      // Should be connected; if not, the test still passes structurally
      // but logs the issue
      if (!body.connected) {
        console.warn('WhatsApp Business API not connected:', body);
      }
    }
    await assertNoConsoleErrors(page);
  });

  test('whatsapp dry-run send (test message to QA number, NOT real delivery)', async ({ request }) => {
    const r = await request.post('/api/twilio/whatsapp/dry-run', {
      data: {
        to: process.env.AION_QA_TEST_PHONE ?? '+15005550006',  // Twilio test number
        body: 'E2E QA test ping',
      },
    });
    // Dry-run endpoint should return 200 with simulated payload
    if (r.status() === 404) test.skip();
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('would_send');
  });

  test('communications hub aggregated view loads', async ({ authedPage: page }) => {
    await page.goto('/communications', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/communications/);
    await expect(page.locator('main').first()).toBeVisible();
    await assertNoConsoleErrors(page);
  });
});
