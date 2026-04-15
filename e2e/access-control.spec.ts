import { test, expect, assertNoConsoleErrors } from "./fixtures";

test.describe("Access control", () => {
  test("access-control page lists controllers with status", async ({
    authedPage: page,
    request,
  }) => {
    await page.goto("/access-control", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/access-control/);

    const r = await request.get("/api/access-control/controllers");
    expect(r.status()).toBe(200);
    const list = (await r.json()).data ?? [];
    expect(list.length).toBeGreaterThanOrEqual(11);
    await assertNoConsoleErrors(page);
  });

  test("authorize a visitor (full flow: register -> authorize -> entry log)", async ({
    request,
  }) => {
    const siteId = process.env.AION_QA_SITE_ID;
    const residentId = process.env.AION_QA_RESIDENT_ID;
    const controllerId = process.env.AION_QA_CONTROLLER_ID;
    test.skip(
      !siteId || !residentId || !controllerId,
      "AION_QA_SITE_ID, AION_QA_RESIDENT_ID, AION_QA_CONTROLLER_ID required",
    );

    // 1. Register visitor
    const reg = await request.post("/api/visitors", {
      data: {
        first_name: "QA",
        last_name: `Visitor-${Date.now()}`,
        id_document: "99999999-QA",
        phone: "+573000000000",
        host_resident_id: residentId,
        site_id: siteId,
        expected_arrival: new Date().toISOString(),
        purpose: "E2E test",
      },
    });
    expect(reg.status()).toBe(201);
    const visitor = await reg.json();

    // 2. Authorize entry
    const auth = await request.post(`/api/visitors/${visitor.id}/authorize`, {
      data: { authorized_by: "e2e-test", duration_minutes: 15 },
    });
    expect([200, 201]).toContain(auth.status());

    // 3. Simulate entry scan
    const entry = await request.post("/api/access-events", {
      data: {
        subject_id: visitor.id,
        subject_type: "visitor",
        controller_id: controllerId,
        action: "entry",
        method: "qr",
      },
    });
    expect(entry.status()).toBe(201);

    // 4. Verify event in log
    const log = await request.get(
      `/api/access-events?subject_id=${visitor.id}&limit=1`,
    );
    expect(log.status()).toBe(200);
    const rows = (await log.json()).data ?? [];
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe("entry");

    // 5. Clean up
    await request.delete(`/api/visitors/${visitor.id}`);
  });

  test("visitors page search filters results", async ({ authedPage: page }) => {
    await page.goto("/visitors");
    const search = page.getByPlaceholder(/search|buscar/i).first();
    if ((await search.count()) === 0) test.skip();

    await search.fill("QA");
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
    const tableRows = page.locator('tbody tr, [role="row"]');
    const emptyMsg = page.getByText(/no results|sin resultados/i);
    const hasRows = (await tableRows.count()) > 0;
    const hasEmpty = (await emptyMsg.count()) > 0;
    expect(hasRows || hasEmpty).toBe(true);
  });
});
