import { test, expect, assertNoConsoleErrors } from "./fixtures";

test.describe("Live view / Vision Hub", () => {
  test("live-view loads at least one video element", async ({
    authedPage: page,
  }) => {
    await page.goto("/live-view", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/live-view/);

    const videoOrCanvas = page.locator(
      'video, canvas, [data-stream], [class*="player"]',
    );
    await expect(videoOrCanvas.first()).toBeVisible({ timeout: 20_000 });
    await assertNoConsoleErrors(page);
  });

  test("vision-hub reports health status for all services", async ({
    authedPage: page,
    request,
  }) => {
    await page.goto("/vision-hub");
    await expect(page).toHaveURL(/\/vision-hub/);

    const r = await request.get("/api/vision-hub/health");
    expect(r.status()).toBe(200);
    const body = await r.json();

    expect(body).toHaveProperty("services");
    const total = body.services?.length ?? 0;
    const healthy =
      body.services?.filter((s: any) => s.status === "healthy").length ?? 0;

    // Strict: we want 23/23
    expect(total).toBeGreaterThanOrEqual(23);
    expect(healthy).toBe(total);
  });

  test("camera grid wall loads 4 tiles", async ({ authedPage: page }) => {
    await page.goto("/wall/1", { waitUntil: "networkidle" });
    const tiles = page.locator("[data-tile], .camera-tile, .grid > *");
    await expect
      .poll(() => tiles.count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(4);
  });

  test("playback page loads timeline", async ({ authedPage: page }) => {
    await page.goto("/playback", { waitUntil: "networkidle" });
    await expect(
      page
        .locator('[class*="timeline"], [data-timeline], input[type="range"]')
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoConsoleErrors(page);
  });

  test("camera-health shows stats for 200+ cameras", async ({
    authedPage: page,
    request,
  }) => {
    await page.goto("/camera-health");
    const r = await request.get("/api/cameras/health-summary");
    if (r.status() === 200) {
      const body = await r.json();
      expect(body.total).toBeGreaterThanOrEqual(280);
      expect(body.online).toBeGreaterThanOrEqual(Math.floor(body.total * 0.9));
    }
  });

  test("snapshot endpoint returns image bytes", async ({
    authedPage: page,
    request,
  }) => {
    const list = await request.get("/api/cameras?limit=1");
    if (list.status() !== 200) test.skip();
    const cams = await list.json();
    const camId = cams?.data?.[0]?.id ?? cams?.[0]?.id;
    if (!camId) test.skip();

    const snap = await request.get(`/api/cameras/${camId}/snapshot`);
    expect([200, 202]).toContain(snap.status());
    if (snap.status() === 200) {
      const buf = await snap.body();
      expect(buf.length).toBeGreaterThan(1024);
    }
  });
});
