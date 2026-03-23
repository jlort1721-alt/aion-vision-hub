/**
 * GUARDRAIL: Prevent direct Supabase access bypass
 *
 * This test ensures all frontend data access goes through the Fastify backend
 * (apiClient) and not directly to Supabase. Direct Supabase access bypasses
 * plan limits, audit logging, rate limiting, and RBAC.
 *
 * ALLOWED exceptions (documented and intentional):
 * - src/contexts/AuthContext.tsx — Supabase Auth (login, signup, session) per ADR-001
 * - src/lib/api-client.ts — getSession/refreshSession for token injection
 * - src/integrations/ — Supabase client initialization
 * - src/hooks/use-realtime-events.ts — Supabase Realtime channels (postgres_changes)
 * - src/test/ — Test files
 * - src/contexts/I18nContext.tsx — reads session for language preference
 * - src/integrations/lovable/ — Cloud auth integration
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const SRC_DIR = resolve(__dirname, '..');

const ALLOWED_FILES = [
  'contexts/AuthContext.tsx',
  'lib/api-client.ts',
  'integrations/supabase/',
  'integrations/lovable/',
  'hooks/use-realtime-events.ts', // Supabase Realtime channels (allowed until WS migration)
  'contexts/I18nContext.tsx',
  'test/',
];

function isAllowed(filePath: string): boolean {
  return ALLOWED_FILES.some((allowed) => filePath.includes(allowed));
}

describe('Supabase bypass guardrail', () => {
  it('no supabase.from() calls in production code (except allowed files)', () => {
    let output = '';
    try {
      output = execSync(
        `grep -rn "supabase\\.from(" "${SRC_DIR}" --include="*.ts" --include="*.tsx" || true`,
        { encoding: 'utf-8' },
      );
    } catch {
      output = '';
    }

    const violations = output
      .split('\n')
      .filter((line) => line.trim())
      .filter((line) => !isAllowed(line));

    if (violations.length > 0) {
      console.error('SUPABASE BYPASS DETECTED in:');
      violations.forEach((v) => console.error(`  ${v}`));
    }

    expect(violations).toEqual([]);
  });

  it('no supabase.storage calls in production code (except allowed files)', () => {
    let output = '';
    try {
      output = execSync(
        `grep -rn "supabase\\.storage" "${SRC_DIR}" --include="*.ts" --include="*.tsx" || true`,
        { encoding: 'utf-8' },
      );
    } catch {
      output = '';
    }

    const violations = output
      .split('\n')
      .filter((line) => line.trim())
      .filter((line) => !isAllowed(line));

    // DocumentsPage still uses supabase.storage — document as known exception
    const storageExceptions = ['pages/DocumentsPage.tsx'];
    const realViolations = violations.filter(
      (v) => !storageExceptions.some((exc) => v.includes(exc)),
    );

    if (realViolations.length > 0) {
      console.error('SUPABASE STORAGE BYPASS DETECTED in:');
      realViolations.forEach((v) => console.error(`  ${v}`));
    }

    expect(realViolations).toEqual([]);
  });

  it('no Edge Function calls via VITE_SUPABASE_URL/functions in production hooks/pages', () => {
    let output = '';
    try {
      output = execSync(
        `grep -rn "VITE_SUPABASE_URL.*functions" "${SRC_DIR}" --include="*.ts" --include="*.tsx" || true`,
        { encoding: 'utf-8' },
      );
    } catch {
      output = '';
    }

    const violations = output
      .split('\n')
      .filter((line) => line.trim())
      .filter((line) => !isAllowed(line))
      // Legacy service files are tracked separately — allow for now
      .filter((line) => !line.includes('services/'));

    if (violations.length > 0) {
      console.error('EDGE FUNCTION BYPASS DETECTED in:');
      violations.forEach((v) => console.error(`  ${v}`));
    }

    expect(violations).toEqual([]);
  });
});
