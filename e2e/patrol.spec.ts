import { test, expect, assertNoConsoleErrors } from "./fixtures";

test.describe("Patrols & Minuta", () => {
  test("patrols page loads with list of patrols", async ({
    authedPage: page,
  }) => {
    await page.goto("/patrols", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/patrols/);
    await expect(page.locator("main").first()).toBeVisible();
    await assertNoConsoleErrors(page);
  });

  test("start patrol -> scan checkpoint -> close minuta", async ({
    request,
  }) => {
    const guardId = process.env.AION_QA_GUARD_ID;
    const siteId = process.env.AION_QA_SITE_ID;
    const routeId = process.env.AION_QA_ROUTE_ID;
    test.skip(
      !guardId || !siteId || !routeId,
      "AION_QA_GUARD_ID, AION_QA_SITE_ID, AION_QA_ROUTE_ID required",
    );

    // 1. Start a patrol
    const start = await request.post("/api/patrols", {
      data: {
        guard_id: guardId,
        site_id: siteId,
        route_id: routeId,
        started_at: new Date().toISOString(),
        source: "e2e-test",
      },
    });
    expect(start.status()).toBe(201);
    const patrol = await start.json();

    // 2. Scan checkpoints
    const checkpoints = [
      process.env.AION_QA_CHECKPOINT_1,
      process.env.AION_QA_CHECKPOINT_2,
      process.env.AION_QA_CHECKPOINT_3,
    ].filter(Boolean);

    for (const cp of checkpoints) {
      const scan = await request.post(`/api/patrols/${patrol.id}/checkpoints`, {
        data: {
          checkpoint_id: cp,
          scanned_at: new Date().toISOString(),
          method: "qr",
          notes: "E2E scan",
        },
      });
      expect([200, 201]).toContain(scan.status());
    }

    // 3. Add minuta entry
    const minuta = await request.post(`/api/patrols/${patrol.id}/minuta`, {
      data: {
        entry: "E2E test — patrol completed without incidents.",
        category: "routine",
      },
    });
    expect([200, 201]).toContain(minuta.status());

    // 4. Close patrol
    const close = await request.patch(`/api/patrols/${patrol.id}`, {
      data: { status: "completed", ended_at: new Date().toISOString() },
    });
    expect(close.status()).toBe(200);

    // 5. Verify summary
    const detail = await request.get(`/api/patrols/${patrol.id}`);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.status).toBe("completed");
    expect(body.checkpoints?.length ?? 0).toBeGreaterThanOrEqual(
      checkpoints.length,
    );
  });

  test("shifts page shows active shift", async ({
    authedPage: page,
    request,
  }) => {
    await page.goto("/shifts");
    const r = await request.get("/api/shifts?status=active");
    expect(r.status()).toBe(200);
    await assertNoConsoleErrors(page);
  });

  test("minuta page loads recent entries", async ({ authedPage: page }) => {
    await page.goto("/minuta", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/minuta/);
    await expect(page.locator("main").first()).toBeVisible();
  });
});
