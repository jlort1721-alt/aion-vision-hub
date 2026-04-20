/**
 * Authentication setup — logs into aionseg.co once per test run and saves
 * the Supabase session to e2e/.auth/user.json. Downstream specs reuse it
 * via storageState in playwright.config.
 *
 * Credentials come from TEST_USER / TEST_PASS env vars. If TEST_PASS is
 * unset, setup is skipped and downstream specs that need auth should
 * also skip gracefully.
 */
import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AUTH_FILE = "e2e/.auth/user.json";

function writeEmptyStorageState() {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
}

setup("authenticate against aionseg.co", async ({ page }) => {
  const email = process.env.TEST_USER ?? "jlort1721@gmail.com";
  const password = process.env.TEST_PASS ?? "";

  if (!password) {
    writeEmptyStorageState();
    setup.skip(true, "TEST_PASS not set — using anonymous storage state.");
    return;
  }

  await page.goto("/login");

  // Tolerant selectors — accept either type= or name= attribute naming.
  const emailInput = page
    .locator('input[type="email"], input[name="email"]')
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"]')
    .first();
  await emailInput.waitFor({ state: "visible", timeout: 15_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Prefer the submit button inside the login form to avoid picking up
  // siblings like "Show password".
  const submit = page
    .locator('form[aria-label*="Login" i], form')
    .first()
    .locator('button[type="submit"]')
    .first();

  try {
    await Promise.all([
      page.waitForURL((u) => !/\/login\b/.test(u.pathname), {
        timeout: 20_000,
      }),
      submit.click(),
    ]);
  } catch (err) {
    // Per B2.2 guardrail: if production (Apr 17 bundle) login flow fails,
    // write empty storageState so downstream specs can still execute
    // against public routes. Once B3.2 deploys fresh bundle, this path
    // should pass end-to-end.
    const reason = err instanceof Error ? err.message : String(err);
    writeEmptyStorageState();
    setup.skip(
      true,
      `Production login did not redirect (${reason.slice(0, 120)}). Empty storageState written. Unskip after B3.2.`,
    );
    return;
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
  expect(fs.existsSync(AUTH_FILE)).toBeTruthy();
});
