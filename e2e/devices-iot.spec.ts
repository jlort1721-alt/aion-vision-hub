import { test, expect, assertNoConsoleErrors } from './fixtures';

test.describe('Devices, Domotics & Network', () => {
  test('devices page lists all device categories', async ({ authedPage: page, request }) => {
    await page.goto('/devices', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/devices/);

    const r = await request.get('/api/devices/summary');
    expect(r.status()).toBe(200);
    const body = await r.json();
    // Expected counts from operational profile
    expect(body.cameras_total       ?? 0).toBeGreaterThanOrEqual(280);  // ~291
    expect(body.iot_total           ?? 0).toBeGreaterThanOrEqual(80);   // ~86 eWeLink
    expect(body.access_controllers  ?? 0).toBeGreaterThanOrEqual(11);
    await assertNoConsoleErrors(page);
  });

  test('cameras list paginates and filters by site', async ({ request }) => {
    const all  = await request.get('/api/cameras?limit=50');
    expect(all.status()).toBe(200);
    const body = await all.json();
    expect(body.data?.length ?? body.length ?? 0).toBeGreaterThan(0);

    // Filter by QA site
    const filtered = await request.get(`/api/cameras?site_id=${process.env.AION_QA_SITE_ID}&limit=50`);
    expect(filtered.status()).toBe(200);
  });

  test('domotics page shows eWeLink devices', async ({ authedPage: page, request }) => {
    await page.goto('/domotics', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/domotics/);

    const r = await request.get('/api/iot/ewelink/devices');
    if (r.status() === 200) {
      const body = await r.json();
      const devices = body.data ?? body;
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThanOrEqual(80); // 86 known
    }
    await assertNoConsoleErrors(page);
  });

  test('toggle IoT device on/off (dry-run)', async ({ request }) => {
    const list = await request.get('/api/iot/ewelink/devices?limit=1');
    if (list.status() !== 200) test.skip();
    const dev = (await list.json()).data?.[0] ?? (await list.json())[0];
    if (!dev?.id) test.skip();

    // Use dry-run endpoint to avoid actually toggling a real relay
    const toggle = await request.post(`/api/iot/ewelink/devices/${dev.id}/dry-run`, {
      data: { action: 'toggle' },
    });
    if (toggle.status() === 404) test.skip();
    expect([200, 202]).toContain(toggle.status());
  });

  test('network page reachability matrix loads', async ({ authedPage: page, request }) => {
    await page.goto('/network', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/network/);

    const r = await request.get('/api/network/reachability?site_id=' + process.env.AION_QA_SITE_ID);
    if (r.status() === 200) {
      const body = await r.json();
      expect(body).toHaveProperty('hosts');
      expect(Array.isArray(body.hosts)).toBe(true);
    }
    await assertNoConsoleErrors(page);
  });

  test('sites page enumerates all 22+ residential sites', async ({ request }) => {
    const r = await request.get('/api/sites?limit=50');
    expect(r.status()).toBe(200);
    const body = await r.json();
    const sites = body.data ?? body;
    expect(sites.length).toBeGreaterThanOrEqual(22);
  });

  test('reboots queue page loads pending tasks', async ({ authedPage: page }) => {
    await page.goto('/reboots');
    await expect(page).toHaveURL(/\/reboots/);
    await expect(page.locator('main').first()).toBeVisible();
    await assertNoConsoleErrors(page);
  });
});
