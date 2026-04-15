import { test as base, expect, Page, BrowserContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export { expect };

const STORAGE_STATE_PATH = path.resolve(".auth/qa-storage-state.json");

type Fixtures = {
  authedPage: Page;
  apiToken: string;
};

/**
 * Perform login once and reuse storage state across tests.
 * Credentials: AION_QA_EMAIL/AION_QA_PASS (preferred) or E2E_USER_EMAIL/E2E_USER_PASSWORD (legacy).
 */
async function globalLogin(page: Page): Promise<void> {
  const email = process.env.AION_QA_EMAIL ?? process.env.E2E_USER_EMAIL;
  const pass = process.env.AION_QA_PASS ?? process.env.E2E_USER_PASSWORD;
  if (!email || !pass) {
    throw new Error(
      "Missing AION_QA_EMAIL/AION_QA_PASS (or E2E_USER_EMAIL/E2E_USER_PASSWORD) in env",
    );
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email|correo/i).fill(email);
  await page.getByLabel(/password|contraseña/i).fill(pass);
  await page
    .getByRole("button", { name: /log\s*in|iniciar|ingresar/i })
    .click();

  await page.waitForURL(/\/(dashboard|live-view|admin)/, { timeout: 20_000 });
  await expect(page.locator("body")).toBeVisible();
}

export const test = base.extend<Fixtures>({
  context: async ({ browser }, use) => {
    let ctx: BrowserContext;
    if (fs.existsSync(STORAGE_STATE_PATH)) {
      ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH });
    } else {
      ctx = await browser.newContext();
      const page = await ctx.newPage();
      await globalLogin(page);
      fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
      await ctx.storageState({ path: STORAGE_STATE_PATH });
      await page.close();
    }
    await use(ctx);
    await ctx.close();
  },

  authedPage: async ({ context }, use) => {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 500) errors.push(`5xx: ${r.status()} ${r.url()}`);
    });
    (page as any).__errors = errors;
    await use(page);
  },

  apiToken: async ({ context }, use) => {
    const cookies = await context.cookies();
    const jwt =
      cookies.find(
        (c) => c.name === "aion_token" || c.name === "sb-access-token",
      )?.value ?? "";
    await use(jwt);
  },
});

/** Assert no console/JS errors happened on the page so far. */
export function assertNoConsoleErrors(page: Page) {
  const errors = (page as any).__errors as string[] | undefined;
  if (errors && errors.length > 0) {
    throw new Error(`Console/JS errors detected:\n${errors.join("\n")}`);
  }
}
