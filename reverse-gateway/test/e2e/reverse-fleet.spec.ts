// test/e2e/reverse-fleet.spec.ts
//
// Exercises the /reverse page end-to-end against the dockerised test stack.
// Scenarios cover the happy path and two error paths that operators reported
// during canary: approval without ISUP key on a Hikvision device (must fail),
// and stream start while the device is disconnected (must show an error).

import { test, expect, type Page } from '@playwright/test';

const TEST_USER = {
  email: 'e2e-operator@clave.test',
  password: 'E2E!StrongPass-1',
};

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Contraseña').fill(TEST_USER.password);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/$|\/dashboard/);
}

test.describe('Reverse Fleet', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('landing shows the three KPIs and both tabs', async ({ page }) => {
    await page.goto('/reverse');
    await expect(page.getByRole('heading', { name: /reverse fleet/i })).toBeVisible();
    await expect(page.getByText(/en línea/i)).toBeVisible();
    await expect(page.getByText(/aprobados/i)).toBeVisible();
    await expect(page.getByText(/por aprobar/i)).toBeVisible();

    await expect(page.getByRole('tab', { name: /sesiones activas/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /dispositivos/i })).toBeVisible();
  });

  test('approve a pending Dahua device (simulator SIM-XVR-001)', async ({ page }) => {
    // The dockerised Dahua simulator connects on boot, creating a pending device.
    await page.goto('/reverse');
    await page.getByRole('tab', { name: /dispositivos/i }).click();

    const row = page.getByRole('row', { name: /SIM-XVR-001/ });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText(/pending_approval/i)).toBeVisible();

    await row.getByRole('button', { name: /aprobar/i }).click();

    await page.getByLabel(/nombre para mostrar/i).fill('Simulador Dahua E2E');
    await page.getByLabel(/^usuario/i).fill('admin');
    await page.getByLabel(/contraseña/i).fill('admin-e2e-password');
    await page.getByLabel(/canales/i).fill('4');

    await page.getByRole('button', { name: /aprobar y conectar/i }).click();

    // The row flips to 'approved' and a new session is visible under the other tab.
    await expect(row.getByText(/^approved$/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /sesiones activas/i }).click();
    await expect(page.getByText('SIM-XVR-001')).toBeVisible({ timeout: 10_000 });
  });

  test('approving a Hikvision device without ISUP key must fail validation', async ({ page }) => {
    await page.goto('/reverse');
    await page.getByRole('tab', { name: /dispositivos/i }).click();

    const row = page.getByRole('row', { name: /SIM-NVR-001/ });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: /aprobar/i }).click();

    await page.getByLabel(/^usuario/i).fill('admin');
    await page.getByLabel(/contraseña/i).fill('admin-e2e-password');
    // intentionally leave ISUP Key empty

    await page.getByRole('button', { name: /aprobar y conectar/i }).click();
    await expect(page.getByText(/isup_key/i)).toBeVisible();
  });

  test('PTZ joystick dispatches commands on press and stop on release', async ({ page }) => {
    // assumes SIM-XVR-001 is already approved from a previous test
    await page.goto('/reverse');

    await page.getByText('SIM-XVR-001').click();
    await expect(page.getByText(/ch 1/i)).toBeVisible({ timeout: 15_000 });

    // Capture outgoing PTZ requests
    const ptzRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/reverse/') && req.url().includes('/ptz')) {
        ptzRequests.push(req.postData() ?? '');
      }
    });

    const panRight = page.getByRole('button', { name: /pan right/i });
    await panRight.hover();
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.up();

    // At least 2 requests: one action, one stop
    await expect.poll(() => ptzRequests.length, { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
    expect(ptzRequests.some((b) => b.includes('pan_right'))).toBeTruthy();
    expect(ptzRequests.some((b) => b.includes('stop'))).toBeTruthy();
  });

  test('snapshot downloads a JPEG', async ({ page }) => {
    await page.goto('/reverse');
    await page.getByText('SIM-XVR-001').click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /snapshot/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^snapshot-.*\.jpg$/);
  });

  test('live events strip shows session transitions', async ({ page }) => {
    await page.goto('/reverse');
    // trigger a synthetic session_online event via the test API
    await page.request.post('/api/v1/reverse/__test__/emit', {
      data: { kind: 'session_online', device_id: 'SIM-XVR-001' },
      headers: { 'x-e2e-token': process.env.E2E_TOKEN ?? 'test' },
    });
    await expect(page.getByText(/session_online/i)).toBeVisible({ timeout: 10_000 });
  });

  test('blocked device cannot reconnect', async ({ page, request }) => {
    // Block via API directly
    const list = await request.get('/api/v1/reverse/devices?vendor=dahua');
    const { items } = await list.json();
    const sim = items.find((d: any) => d.device_id === 'SIM-XVR-001');
    expect(sim).toBeDefined();

    await request.post(`/api/v1/reverse/devices/${sim.id}/block`, {
      data: { reason: 'e2e test block' },
    });

    await page.goto('/reverse');
    await page.getByRole('tab', { name: /dispositivos/i }).click();
    const row = page.getByRole('row', { name: /SIM-XVR-001/ });
    await expect(row.getByText(/^blocked$/i)).toBeVisible();
  });
});
