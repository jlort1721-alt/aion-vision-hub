/**
 * DEPRECATED — Supabase was removed from AION Vision Hub on 2026-04-15.
 *
 * This file exists ONLY so that legacy `vi.mock("@/integrations/supabase/client", ...)`
 * calls in 11 test files can still resolve a module path. The runtime export is a
 * proxy that throws on any access, guaranteeing production code cannot use it.
 *
 * Planned removal: when the 11 legacy tests are rewritten to mock the Fastify
 * backend apiClient instead, this file should be deleted along with them.
 *
 * Runtime alternative: `import { apiClient } from '@/lib/api-client'`.
 */

const trap: ProxyHandler<Record<string, unknown>> = {
  get(_t, prop) {
    throw new Error(
      `Supabase client was removed on 2026-04-15. Offending access: supabase.${String(prop)}. ` +
        `Use apiClient (@/lib/api-client) against the Fastify backend instead.`,
    );
  },
};

export const supabase = new Proxy<Record<string, unknown>>({}, trap);
