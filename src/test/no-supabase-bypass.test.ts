/**
 * GUARDRAIL: Prevent any Supabase usage in production code.
 *
 * Supabase was fully removed on 2026-04-15. Auth is backend-issued JWT
 * (@fastify/jwt + scrypt + local profiles/refresh_tokens tables). Realtime
 * is served by the native Fastify WebSocket plugin with Redis pub/sub.
 *
 * Any reintroduction of `@supabase/*`, `supabase.from()`, `supabase.storage`,
 * `supabase.auth`, `supabase.rpc`, `supabase.channel`, or
 * `VITE_SUPABASE_URL/functions` is forbidden and must fail CI.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve } from "path";

const SRC_DIR = resolve(__dirname, "..");

// Test files and the guardrail itself are exempt.
const ALLOWED_FILES = ["test/"];

function isAllowed(filePath: string): boolean {
  return ALLOWED_FILES.some((allowed) => filePath.includes(allowed));
}

function grepSrc(pattern: string): string[] {
  let output = "";
  try {
    output = execSync(
      `grep -rn "${pattern}" "${SRC_DIR}" --include="*.ts" --include="*.tsx" || true`,
      { encoding: "utf-8" },
    );
  } catch {
    output = "";
  }
  return output
    .split("\n")
    .filter((line) => line.trim())
    .filter((line) => !isAllowed(line));
}

describe("Supabase bypass guardrail", () => {
  it("no supabase.from() calls in production code", () => {
    const violations = grepSrc("supabase\\.from(");
    expect(
      violations,
      "Supabase removed; see no-supabase-bypass.test.ts",
    ).toEqual([]);
  });

  it("no supabase.storage calls in production code", () => {
    const violations = grepSrc("supabase\\.storage");
    expect(violations).toEqual([]);
  });

  it("no supabase.auth calls in production code", () => {
    const violations = grepSrc("supabase\\.auth");
    expect(violations).toEqual([]);
  });

  it("no supabase.rpc calls in production code", () => {
    const violations = grepSrc("supabase\\.rpc");
    expect(violations).toEqual([]);
  });

  it("no supabase.channel calls in production code", () => {
    const violations = grepSrc("supabase\\.channel");
    expect(violations).toEqual([]);
  });

  it("no @supabase/* imports in production code", () => {
    const violations = grepSrc("from ['\"]@supabase");
    expect(violations).toEqual([]);
  });

  it("no Edge Function URLs via VITE_SUPABASE_URL", () => {
    const violations = grepSrc("VITE_SUPABASE_URL.*functions");
    expect(violations).toEqual([]);
  });
});
