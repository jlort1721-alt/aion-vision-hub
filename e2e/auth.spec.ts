import { test, expect, assertNoConsoleErrors } from "./fixtures";

test.describe("Auth flow", () => {
  test("login page loads and has required fields", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");

    await expect(page).toHaveTitle(/aion|login|ingresar/i);
    await expect(page.getByLabel(/email|correo/i)).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /log\s*in|ingresar|iniciar/i }),
    ).toBeEnabled();
    await ctx.close();
  });

  test("invalid credentials show error, do not redirect", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");

    await page.getByLabel(/email|correo/i).fill("nobody@aionseg.co");
    await page
      .locator('input[type="password"]')
      .first()
      .fill("wrong-password-xyz");
    await page.getByRole("button", { name: /log\s*in|ingresar/i }).click();

    await expect(
      page.getByText(/invalid|incorrect|inválid|error/i),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test("authenticated user lands on dashboard", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main, [role="main"], #content')).toBeVisible();
    await assertNoConsoleErrors(page);
  });

  test("session persists across reload", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main, [role="main"], #content')).toBeVisible();
  });

  test("logout clears session and redirects to login", async ({
    authedPage: page,
  }) => {
    await page.goto("/dashboard");
    const logout = page
      .getByRole("button", { name: /log\s*out|cerrar sesión|salir/i })
      .first();
    if ((await logout.count()) === 0) {
      await page
        .getByRole("button", { name: /menu|cuenta|perfil/i })
        .first()
        .click({ trial: true });
    }
    await logout.click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("api/health returns healthy", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.status).toBe("healthy");
  });
});
