import { Page, expect } from '@playwright/test';

// SECURITY: Load credentials from environment, never hardcode
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `E2E tests require ${name} environment variable.\n` +
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD in your CI environment or shell before running tests.'
    );
  }
  return value;
}

const EMAIL = requireEnv('E2E_USER_EMAIL');
const PASSWORD = requireEnv('E2E_USER_PASSWORD');

/** Login and navigate to dashboard. Reusable across all test suites. */
export async function loginAsOperator(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo Electrónico').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await expect(page).toHaveURL(/dashboard/);
}

/** Navigate via sidebar clicking */
export async function navigateVia(page: Page, label: string): Promise<void> {
  const navButton = page.locator('aside[role="navigation"]').getByText(label, { exact: false }).first();
  await navButton.click();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
}
