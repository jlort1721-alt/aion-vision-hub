/**
 * Shared Supabase verification utilities.
 * Single source of truth — no hardcoded URLs, no fallbacks.
 */

import { RedisCache } from './cache.js';

const supabaseTokenCache = new RedisCache<{ id: string; email: string }>('supa_token', 300_000);

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL environment variable is required');
  return url;
}

function getSupabaseKey(): string {
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('SUPABASE_ANON_KEY environment variable is required');
  return key;
}

/**
 * Verify a Supabase access token by calling the Supabase /auth/v1/user endpoint.
 * Returns user info if valid, null otherwise.
 * Results are cached in Redis for 5 minutes to avoid repeated HTTP calls.
 */
export async function verifySupabaseToken(token: string): Promise<{ id: string; email: string } | null> {
  // Use first 16 chars of token as cache key hash
  const tokenHash = token.substring(0, 16);

  // Check Redis cache first
  const cached = await supabaseTokenCache.get(tokenHash);
  if (cached) return cached;

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseKey();

  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey,
      },
    });
    if (!resp.ok) return null;
    const user = await resp.json() as { id: string; email: string };

    // Cache successful verification for 5 minutes
    await supabaseTokenCache.set(tokenHash, user);

    return user;
  } catch {
    return null;
  }
}
