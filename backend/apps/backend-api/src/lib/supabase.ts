/**
 * Shared Supabase verification utilities.
 * Single source of truth — no hardcoded URLs, no fallbacks.
 */

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
 */
export async function verifySupabaseToken(token: string): Promise<{ id: string; email: string } | null> {
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
    return user;
  } catch {
    return null;
  }
}
