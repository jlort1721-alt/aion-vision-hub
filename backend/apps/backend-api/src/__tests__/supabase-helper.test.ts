import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Supabase helper — no hardcoded URLs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws if SUPABASE_URL is not configured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;

    const { verifySupabaseToken } = await import('../lib/supabase.js');

    // Should throw because no URL is configured (no hardcoded fallback)
    await expect(async () => {
      await verifySupabaseToken('test-token');
    }).rejects.toThrow('SUPABASE_URL environment variable is required');
  });

  it('throws if SUPABASE_ANON_KEY is not configured', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const { verifySupabaseToken } = await import('../lib/supabase.js');

    await expect(async () => {
      await verifySupabaseToken('test-token');
    }).rejects.toThrow('SUPABASE_ANON_KEY environment variable is required');
  });

  it('uses SUPABASE_URL when set', async () => {
    process.env.SUPABASE_URL = 'https://myproject.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    const { verifySupabaseToken } = await import('../lib/supabase.js');

    // Will try to fetch and fail (no real server), returning null
    const result = await verifySupabaseToken('test-token');
    expect(result).toBeNull();
  });
});
