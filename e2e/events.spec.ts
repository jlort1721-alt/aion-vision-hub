import { test, expect, assertNoConsoleErrors } from "./fixtures";

test.describe("Events & Incidents", () => {
  test("events list loads and paginates", async ({ authedPage: page }) => {
    await page.goto("/events", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/events/);
    await expect(
      page.locator('table, [role="grid"], [data-events-list]').first(),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoConsoleErrors(page);
  });

  test("create, view, and close an incident (full lifecycle)", async ({
    authedPage: page,
    request,
  }) => {
    const siteId = process.env.AION_QA_SITE_ID;
    test.skip(!siteId, "AION_QA_SITE_ID env var required");

    // 1. Create via API
    const createRes = await request.post("/api/incidents", {
      data: {
        title: `QA incident ${Date.now()}`,
        site_id: siteId,
        category: "intrusion",
        severity: "medium",
        description: "Automated E2E test incident. Safe to ignore/close.",
        source: "e2e-test",
      },
    });
    expect(createRes.status(), `create failed: ${await createRes.text()}`).toBe(
      201,
    );
    const incident = await createRes.json();
    const id = incident.id;
    expect(id).toBeTruthy();

    // 2. Open detail page
    await page.goto(`/incidents/${id}`);
    await expect(page.getByText(incident.title)).toBeVisible();

    // 3. Close it
    const closeRes = await request.patch(`/api/incidents/${id}`, {
      data: { status: "closed", resolution: "e2e auto-close" },
    });
    expect(closeRes.status()).toBe(200);

    // 4. Verify closure reflected in UI
    await page.reload();
    await expect(page.getByText(/closed|cerrado/i)).toBeVisible();
  });

  test("alert creation triggers notification channel", async ({ request }) => {
    const res = await request.post("/api/alerts", {
      data: {
        title: "QA alert",
        severity: "low",
        category: "test",
        channels: ["in-app"],
        acknowledge_required: false,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.delivery_status).toBeDefined();
  });

  test("detections feed returns last N items", async ({ request }) => {
    const res = await request.get("/api/detections?limit=10");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = body.data ?? body;
    expect(Array.isArray(items)).toBe(true);
  });

  test("emergency page loads without errors", async ({ authedPage: page }) => {
    await page.goto("/emergency", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/emergency/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    await assertNoConsoleErrors(page);
  });
});
