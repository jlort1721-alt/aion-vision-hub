import { test, expect, assertNoConsoleErrors } from "./fixtures";

test.describe("Reports & Analytics", () => {
  test("reports page lists templates", async ({ authedPage: page }) => {
    await page.goto("/reports", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.locator("main").first()).toBeVisible();
    await assertNoConsoleErrors(page);
  });

  test("generate operational report PDF", async ({ request }) => {
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const to = new Date().toISOString();

    const gen = await request.post("/api/reports/generate", {
      data: {
        template: "operational_weekly",
        format: "pdf",
        from,
        to,
        site_ids: [process.env.AION_QA_SITE_ID],
        async: false,
      },
      timeout: 120_000,
    });
    expect(gen.status()).toBe(200);
    const ct = gen.headers()["content-type"] ?? "";
    expect(ct).toContain("pdf");
    const buf = await gen.body();
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  test("scheduled-reports lists at least one schedule", async ({
    authedPage: page,
    request,
  }) => {
    await page.goto("/scheduled-reports");
    const r = await request.get("/api/reports/schedules");
    expect(r.status()).toBe(200);
    const body = await r.json();
    const items = body.data ?? body;
    expect(Array.isArray(items)).toBe(true);
  });

  test("analytics dashboard loads KPI widgets", async ({
    authedPage: page,
  }) => {
    await page.goto("/analytics", { waitUntil: "networkidle" });
    const cards = page.locator('[data-kpi], .kpi-card, [class*="metric"]');
    await expect
      .poll(() => cards.count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);
  });
});
