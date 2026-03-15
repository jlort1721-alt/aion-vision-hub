/**
 * Shared authentication helper for edge functions.
 * Validates JWT, extracts user info and tenant context.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface AuthContext {
  supabase: SupabaseClient;
  userId: string;
  email: string;
  tenantId: string | null;
}

export async function getAuthContext(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");

  const userId = data.claims.sub as string;
  const email = (data.claims as any).email as string;

  // Resolve tenant (best-effort, null if not found)
  let tenantId: string | null = null;
  try {
    const { data: tid } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
    tenantId = tid;
  } catch { /* tenant resolution is best-effort */ }

  return { supabase, userId, email, tenantId };
}

export async function writeAudit(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  email: string,
  action: string,
  entityType: string,
  entityId?: string,
  before?: unknown,
  after?: unknown
): Promise<void> {
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: userId,
    user_email: email,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    before_state: before || null,
    after_state: after || null,
  });
}
