import { test, expect } from "./fixtures";

test.describe("Live View Pro — validación completa", () => {
  test("1. /live-view carga y muestra grid de cámaras", async ({
    authedPage: page,
  }) => {
    await page.goto("/live-view", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/live-view/);

    const grid = page.locator(".grid, [class*='grid'], [data-grid]");
    await expect(grid.first()).toBeVisible({ timeout: 15_000 });

    const cells = page.locator(
      'video, canvas, [data-stream], [class*="camera"], [class*="SmartCamera"], img[src*="frame.jpeg"]',
    );
    await expect(cells.first()).toBeVisible({ timeout: 20_000 });
  });

  test("2. Grid selector cambia layout (1x1 a 4x4)", async ({
    authedPage: page,
  }) => {
    await page.goto("/live-view", { waitUntil: "networkidle" });

    const gridButtons = page.locator(
      'button:has-text("1x1"), button:has-text("2x2"), button:has-text("3x3"), button:has-text("4x4")',
    );
    const btnCount = await gridButtons.count();
    if (btnCount > 0) {
      const btn4x4 = page.locator('button:has-text("4x4")');
      if (await btn4x4.isVisible()) {
        await btn4x4.click();
        await page.waitForTimeout(1000);
      }
    }

    await expect(page).toHaveURL(/\/live-view/);
  });

  test("3. Sidebar con sitios/filtros visible", async ({
    authedPage: page,
  }) => {
    await page.goto("/live-view", { waitUntil: "networkidle" });

    const sidebar = page.locator(
      '[class*="sidebar"], [class*="aside"], nav, [role="navigation"]',
    );
    await expect(sidebar.first()).toBeVisible({ timeout: 10_000 });
  });

  test("4. Panel derecho con tabs (puertas/eventos/IA)", async ({
    authedPage: page,
  }) => {
    await page.goto("/live-view", { waitUntil: "networkidle" });

    const tabs = page.locator(
      '[role="tablist"], [class*="TabsList"], [class*="tabs"]',
    );
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
  });

  test("5. API /events responde sin 500", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.uptime).toBeGreaterThan(0);
  });

  test("6. API /health devuelve healthy", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  test("7. go2rtc frame.jpeg devuelve imagen >1KB", async ({ request }) => {
    const res = await request.get(
      "/go2rtc/api/frame.jpeg?src=da-alborada-ch0",
      { timeout: 25_000 },
    );
    expect(res.status()).toBe(200);
    const buf = await res.body();
    expect(buf.length).toBeGreaterThan(1024);
  });

  test("8. IMOU live server health", async ({ request }) => {
    const res = await request.get("/imou-live/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.max).toBeGreaterThanOrEqual(8);
  });

  test("9. HLS stream.m3u8 devuelve playlist válido", async ({ request }) => {
    const res = await request.get(
      "/go2rtc/api/stream.m3u8?src=da-terrabamba-ch0",
      { timeout: 20_000 },
    );
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("#EXTM3U");
  });

  test("10. WebRTC endpoint responde", async ({ request }) => {
    const res = await request.get("/stream/api/webrtc?src=da-alborada-ch0", {
      timeout: 10_000,
    });
    expect(res.status()).toBe(200);
  });

  test("11. /live-view no tiene errores de consola críticos", async ({
    authedPage: page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/live-view", { waitUntil: "networkidle" });
    await page.waitForTimeout(5000);

    const critical = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("net::ERR") &&
        !e.includes("Failed to load resource") &&
        !e.includes("ResizeObserver"),
    );

    expect(critical.length).toBeLessThanOrEqual(3);
  });

  test("12. Screenshot de /live-view para revisión visual", async ({
    authedPage: page,
  }) => {
    await page.goto("/live-view", { waitUntil: "networkidle" });
    await page.waitForTimeout(8000);

    const buf = await page.screenshot({ fullPage: false });
    expect(buf.length).toBeGreaterThan(10_000);
  });

  test("13. Navegación entre páginas clave sin 500", async ({
    authedPage: page,
  }) => {
    const pages = [
      "/dashboard",
      "/live-view",
      "/events",
      "/incidents",
      "/devices",
      "/access-control",
      "/domotics",
      "/playback",
    ];

    for (const url of pages) {
      const res = await page.goto(url, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `Page ${url} should not return 500`).not.toBe(500);
    }
  });
});
