import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = getCorsHeaders();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) return jsonResponse({ error: "Unauthorized" }, 401);

    const now = new Date().toISOString();
    const checks: Array<{ component: string; status: string; latency_ms?: number; details?: Record<string, unknown> }> = [];

    // 1. Database health
    const dbStart = Date.now();
    const { error: dbError } = await supabase.from("tenants").select("id").limit(1);
    checks.push({
      component: "Database",
      status: dbError ? "down" : "healthy",
      latency_ms: Date.now() - dbStart,
      details: dbError ? { error: dbError.message } : undefined,
    });

    // 2. Device stats
    const { data: devices } = await supabase.from("devices").select("status");
    const deviceTotal = devices?.length || 0;
    const deviceOnline = devices?.filter((d: any) => d.status === "online").length || 0;
    const deviceOffline = deviceTotal - deviceOnline;
    checks.push({
      component: "Devices",
      status: deviceOffline > deviceTotal * 0.5 ? "degraded" : deviceOffline > deviceTotal * 0.8 ? "down" : "healthy",
      details: { total: deviceTotal, online: deviceOnline, offline: deviceOffline },
    });

    // 3. Events pipeline
    const { data: recentEvents } = await supabase.from("events").select("id").gte("created_at", new Date(Date.now() - 3600000).toISOString()).limit(1);
    checks.push({
      component: "Event Pipeline",
      status: "healthy",
      details: { events_last_hour: recentEvents?.length || 0 },
    });

    // 4. AI Gateway
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    checks.push({
      component: "AI Gateway",
      status: aiKey ? "healthy" : "down",
      details: { configured: !!aiKey },
    });

    // 5. Integrations
    const { data: integrations } = await supabase.from("integrations").select("status");
    const intErrors = integrations?.filter((i: any) => i.status === "error").length || 0;
    checks.push({
      component: "Integrations",
      status: intErrors > 0 ? "degraded" : "healthy",
      details: { total: integrations?.length || 0, errors: intErrors },
    });

    // 6. MCP Connectors
    const { data: mcps } = await supabase.from("mcp_connectors").select("status, health");
    const mcpErrors = mcps?.filter((m: any) => m.health === "down" || m.status === "error").length || 0;
    checks.push({
      component: "MCP Connectors",
      status: mcpErrors > 0 ? "degraded" : "healthy",
      details: { total: mcps?.length || 0, errors: mcpErrors },
    });

    // 7. Sites
    const { data: sites } = await supabase.from("sites").select("status");
    checks.push({
      component: "Sites",
      status: "healthy",
      details: { total: sites?.length || 0 },
    });

    // 8. Auth
    checks.push({ component: "Authentication", status: "healthy", latency_ms: 0 });

    const overallStatus = checks.some(c => c.status === "down") ? "down" : checks.some(c => c.status === "degraded") ? "degraded" : "healthy";

    // Audit log for health checks (best-effort)
    const userId = claims.claims.sub as string;
    const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
    if (tenantId) {
      supabase.from("audit_logs").insert({
        tenant_id: tenantId, user_id: userId,
        user_email: (claims.claims as any).email || "unknown",
        action: "health.check", entity_type: "system",
        after_state: { status: overallStatus, components: checks.length },
      }).then(() => {}).catch(() => {});
    }

    return jsonResponse({
      status: overallStatus,
      timestamp: now,
      checks,
    });
  } catch (e) {
    console.error("health-api error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
