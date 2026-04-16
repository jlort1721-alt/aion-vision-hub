import { test, expect, assertNoConsoleErrors } from "./fixtures";

test.describe("AI Assistant (Agent)", () => {
  test("ai-assistant page renders chat input", async ({ authedPage: page }) => {
    await page.goto("/ai-assistant", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/ai-assistant/);
    await expect(
      page
        .locator('textarea, [role="textbox"], [contenteditable="true"]')
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await assertNoConsoleErrors(page);
  });

  test("simple prompt returns streaming response", async ({
    authedPage: page,
  }) => {
    await page.goto("/ai-assistant");
    const input = page
      .locator('textarea, [role="textbox"], [contenteditable="true"]')
      .first();
    await input.click();
    await input.fill(
      'Responde unicamente con la palabra "PONG" en mayusculas.',
    );

    await page.getByRole("button", { name: /send|enviar/i }).click();

    await expect(
      page.locator('[data-role="assistant"], .message.assistant').last(),
    ).toContainText(/PONG/i, { timeout: 30_000 });
  });

  test("tool use: query device count via agent", async ({
    authedPage: page,
  }) => {
    await page.goto("/ai-assistant");
    const input = page
      .locator('textarea, [role="textbox"], [contenteditable="true"]')
      .first();
    await input.click();
    await input.fill(
      "Cuantos dispositivos IoT eWeLink hay registrados? Responde solo con el numero.",
    );
    await page.getByRole("button", { name: /send|enviar/i }).click();

    const last = page
      .locator('[data-role="assistant"], .message.assistant')
      .last();
    await expect(last).toBeVisible({ timeout: 45_000 });
    const text = await last.textContent();
    const match = text?.match(/\b(\d{2,3})\b/);
    expect(match).toBeTruthy();
    const n = Number(match![1]);
    expect(n).toBeGreaterThanOrEqual(60);
    expect(n).toBeLessThanOrEqual(120);
  });

  test("model router routes to Haiku for cheap ops", async ({ request }) => {
    const r = await request.get("/api/model-router/stats?window=1h");
    if (r.status() !== 200) test.skip();
    const body = await r.json();
    const totals = body.by_model ?? {};
    const haiku = totals["claude-haiku-4-5-20251001"] ?? 0;
    const total = Object.values<number>(totals).reduce((a, b) => a + b, 0);
    if (total > 10) {
      expect(haiku / total).toBeGreaterThanOrEqual(0.5);
    }
  });

  test("audit tool uses opus/sonnet, not haiku", async ({ request }) => {
    const r = await request.post("/api/agent/dry-run", {
      data: { tool: "security_audit_report", input: { scope: "test" } },
    });
    if (r.status() !== 200) test.skip();
    const body = await r.json();
    expect(body.routed_model).toMatch(/opus|sonnet/);
  });
});
