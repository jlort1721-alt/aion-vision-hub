/**
 * Shared helpers for e2e specs.
 *
 * requireAuth: called in beforeEach of auth-gated specs. Waits for the
 * SPA to settle (up to 4s) then detects whether a login form is shown
 * OR the URL contains /login. If so, marks the test as skipped.
 * This lets specs run against public/unauthenticated bundles without
 * failing, while still running their assertions when auth is available.
 */
import { Page, test } from "@playwright/test";

export async function requireAuth(page: Page): Promise<void> {
  // Give the SPA a moment to redirect or render its login fallback.
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const urlHasLogin = /\/login\b/.test(page.url());
  if (urlHasLogin) {
    test.skip(
      true,
      `Redirected to /login — auth.setup skipped. Unskip after B3.2.`,
    );
  }

  const loginForm = page
    .locator('form[aria-label*="Login" i], input[type="password"]')
    .first();
  const onLoginPage = await loginForm
    .isVisible({ timeout: 4_000 })
    .catch(() => false);
  if (onLoginPage) {
    test.skip(
      true,
      "Login form detected — auth.setup skipped. Unskip after B3.2 deploy.",
    );
  }
}
