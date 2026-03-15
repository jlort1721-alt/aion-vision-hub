import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = getCorsHeaders();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getAuthClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");
  return { supabase, userId: data.claims.sub as string };
}

// Validate ISO8601 date string
function isValidDate(str: string | null): boolean {
  if (!str) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

const MAX_RECORDS = 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabase, userId } = await getAuthClient(req);
    const url = new URL(req.url);
    const reportType = url.searchParams.get("type") || "summary";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // Validate date params if provided
    if (from && !isValidDate(from)) return jsonResponse({ error: "Invalid 'from' date format" }, 400);
    if (to && !isValidDate(to)) return jsonResponse({ error: "Invalid 'to' date format" }, 400);

    // RLS on the Supabase client ensures tenant isolation since we pass the user's JWT
    // The client was created with the user's auth token, so RLS policies apply automatically

    if (reportType === "events") {
      let query = supabase.from("events").select("*").order("created_at", { ascending: false }).limit(MAX_RECORDS);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);
      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);

      const bySeverity: Record<string, number> = {};
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      for (const e of data || []) {
        bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
        byType[e.event_type] = (byType[e.event_type] || 0) + 1;
        byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      }
      return jsonResponse({ total: data?.length || 0, by_severity: bySeverity, by_type: byType, by_status: byStatus, records: data });
    }

    if (reportType === "incidents") {
      let query = supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(MAX_RECORDS);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);
      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      for (const i of data || []) {
        byStatus[i.status] = (byStatus[i.status] || 0) + 1;
        byPriority[i.priority] = (byPriority[i.priority] || 0) + 1;
      }
      return jsonResponse({ total: data?.length || 0, by_status: byStatus, by_priority: byPriority, records: data });
    }

    if (reportType === "devices") {
      const { data, error } = await supabase.from("devices").select("*").order("name").limit(MAX_RECORDS);
      if (error) return jsonResponse({ error: error.message }, 500);
      const byStatus: Record<string, number> = {};
      const byBrand: Record<string, number> = {};
      for (const d of data || []) {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
        byBrand[d.brand] = (byBrand[d.brand] || 0) + 1;
      }
      return jsonResponse({ total: data?.length || 0, by_status: byStatus, by_brand: byBrand, records: data });
    }

    // Audit log report generation (best-effort)
    const { data: rptTenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
    if (rptTenantId) {
      supabase.from("audit_logs").insert({
        tenant_id: rptTenantId, user_id: userId, user_email: "system",
        action: "report.generated", entity_type: "report",
        after_state: { type: reportType, from, to },
      }).then(() => {}).catch(() => {});
    }

    // Summary report
    const [{ data: devices }, { data: events }, { data: incidents }, { data: sites }] = await Promise.all([
      supabase.from("devices").select("status").limit(MAX_RECORDS),
      supabase.from("events").select("severity, status").order("created_at", { ascending: false }).limit(500),
      supabase.from("incidents").select("status, priority").limit(MAX_RECORDS),
      supabase.from("sites").select("status").limit(MAX_RECORDS),
    ]);

    return jsonResponse({
      type: "summary",
      generated_at: new Date().toISOString(),
      devices: { total: devices?.length || 0, online: devices?.filter((d: any) => d.status === "online").length || 0 },
      events: { total: events?.length || 0, critical: events?.filter((e: any) => e.severity === "critical").length || 0, unresolved: events?.filter((e: any) => e.status === "new").length || 0 },
      incidents: { total: incidents?.length || 0, open: incidents?.filter((i: any) => i.status === "open" || i.status === "investigating").length || 0 },
      sites: { total: sites?.length || 0 },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") return jsonResponse({ error: "Unauthorized" }, 401);
    console.error("reports-api error:", e);
    return jsonResponse({ error: "An error occurred" }, 500);
  }
});
