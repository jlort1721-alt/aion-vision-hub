/**
 * PWA manifest — fetches /manifest.webmanifest and validates display mode,
 * required icon sizes, and orientation. Works against production directly
 * (no auth required).
 */
import { test, expect } from "@playwright/test";

test.describe("PWA manifest", () => {
  test("manifest.webmanifest returns valid JSON", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest).toHaveProperty("name");
    expect(manifest).toHaveProperty("icons");
    expect(Array.isArray(manifest.icons)).toBeTruthy();
  });

  test("manifest declares valid display + optional orientation", async ({
    request,
  }) => {
    const res = await request.get("/manifest.webmanifest");
    const manifest = await res.json();
    expect(["fullscreen", "standalone", "minimal-ui", "browser"]).toContain(
      manifest.display,
    );
    if (manifest.orientation) {
      expect(typeof manifest.orientation).toBe("string");
    }
  });

  test("manifest contains 192 and 512 icon sizes", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    const manifest = await res.json();
    const sizes = (manifest.icons ?? []).map(
      (i: { sizes?: string }) => i.sizes ?? "",
    );
    expect(sizes.some((s: string) => s.includes("192"))).toBeTruthy();
    expect(sizes.some((s: string) => s.includes("512"))).toBeTruthy();
  });

  test("HTML references the manifest", async ({ page }) => {
    await page.goto("/");
    const manifestLink = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    expect(manifestLink).toBeTruthy();
    expect(manifestLink).toMatch(/manifest/);
  });
});
