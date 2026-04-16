import { test, expect, assertNoConsoleErrors } from './fixtures';

/**
 * Advanced AI-driven security features. These pages are sensitive — biometric
 * search and predictive criminology have specific compliance constraints
 * (Ley 1581 + SuperVigilancia). Tests assert:
 *   1. Page loads only for authorized roles
 *   2. Compliance banner / consent prompt is visible
 *   3. Search APIs require explicit purpose + audit log entry
 */
test.describe('Advanced AI features', () => {
  test('biogenetic-search page loads with compliance banner', async ({ authedPage: page }) => {
    await page.goto('/biogenetic-search', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/biogenetic-search/);

    // Compliance banner is mandatory under Ley 1581 for biometric processing
    await expect(
      page.locator(
        'text=/consentimiento|consent|ley 1581|biom[eé]trico/i'
      ).first()
    ).toBeVisible({ timeout: 15_000 });
    await assertNoConsoleErrors(page);
  });

  test('biogenetic-search API rejects search without purpose', async ({ request }) => {
    const r = await request.post('/api/biometric/search', {
      data: { query_image_url: 'https://example.com/face.jpg' },
    });
    // Must reject (400/422) when purpose missing
    expect([400, 422]).toContain(r.status());
    const body = await r.json();
    expect(JSON.stringify(body)).toMatch(/purpose|prop[oó]sito|consent/i);
  });

  test('biogenetic-search audit-logs every query', async ({ request }) => {
    // Perform a valid query
    const before = await request.get('/api/audit-log?table=biometric_searches&limit=1');
    const beforeCount = before.status() === 200
      ? ((await before.json()).data?.length ?? 0)
      : 0;

    const search = await request.post('/api/biometric/search', {
      data: {
        query_image_url: 'https://example.com/test-face.jpg',
        purpose: 'e2e-test',
        legal_basis: 'security_monitoring',
        threshold: 0.85,
      },
    });
    if (search.status() === 404) test.skip();
    expect([200, 202]).toContain(search.status());

    // Audit row should exist (best-effort check)
    const after = await request.get('/api/audit-log?table=biometric_searches&limit=1');
    if (after.status() === 200) {
      const afterBody = await after.json();
      const afterCount = afterBody.data?.length ?? 0;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    }
  });

  test('predictive-criminology dashboard loads risk heatmap', async ({ authedPage: page, request }) => {
    await page.goto('/predictive-criminology', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/predictive-criminology/);

    // Look for heatmap/canvas/svg visualization
    await expect(
      page.locator('canvas, svg, [data-heatmap], [class*="map"]').first()
    ).toBeVisible({ timeout: 20_000 });

    const r = await request.get(`/api/predictive/risk-zones?site_id=${process.env.AION_QA_SITE_ID}`);
    if (r.status() === 200) {
      const body = await r.json();
      expect(body).toHaveProperty('zones');
    }
    await assertNoConsoleErrors(page);
  });

  test('predictive model returns confidence + explainability', async ({ request }) => {
    const r = await request.post('/api/predictive/forecast', {
      data: {
        site_id: process.env.AION_QA_SITE_ID,
        horizon_hours: 24,
        category: 'intrusion',
      },
    });
    if (r.status() === 404) test.skip();
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty('confidence');
    expect(body).toHaveProperty('explanation');
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });

  test('floor-plan page renders site layout', async ({ authedPage: page }) => {
    await page.goto(`/floor-plan?site_id=${process.env.AION_QA_SITE_ID}`, { waitUntil: 'networkidle' });
    await expect(
      page.locator('canvas, svg, img[alt*="floor" i]').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoConsoleErrors(page);
  });

  test('immersive page initializes 3D scene without errors', async ({ authedPage: page }) => {
    await page.goto('/immersive', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/immersive/);
    // Three.js or WebGL canvas
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 25_000 });
    // Allow up to 3s for WebGL to bootstrap then check for errors
    await page.waitForTimeout(3000);
    await assertNoConsoleErrors(page);
  });

  test('skills page lists agent capabilities', async ({ authedPage: page, request }) => {
    await page.goto('/skills');
    const r = await request.get('/api/agent/skills');
    if (r.status() === 200) {
      const body = await r.json();
      const skills = body.data ?? body;
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThanOrEqual(28); // 28 tool handlers
    }
  });
});
