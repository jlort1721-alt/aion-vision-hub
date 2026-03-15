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
  return { supabase, userId: data.claims.sub as string, email: (data.claims as any).email as string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabase, userId, email } = await getAuthClient(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const connectorId = url.searchParams.get("id");

    // GET — list or single
    if (req.method === "GET") {
      if (connectorId) {
        const { data, error } = await supabase.from("mcp_connectors").select("*").eq("id", connectorId).single();
        if (error) return jsonResponse({ error: error.message }, 404);
        return jsonResponse(data);
      }
      const { data, error } = await supabase.from("mcp_connectors").select("*").order("name");
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(data);
    }

    // POST — create or action
    if (req.method === "POST") {
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
      if (!tenantId) return jsonResponse({ error: "No tenant" }, 403);

      if (action === "health-check" && connectorId) {
        // Simulate health check
        const latency = Math.floor(Math.random() * 100) + 20;
        const healthy = Math.random() > 0.1;
        const update = {
          health: healthy ? "healthy" : "degraded",
          last_check: new Date().toISOString(),
          error_count: healthy ? 0 : 1,
        };
        const { data, error } = await supabase.from("mcp_connectors").update(update).eq("id", connectorId).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ ...data, check_latency_ms: latency });
      }

      if (action === "toggle" && connectorId) {
        const { data: current } = await supabase.from("mcp_connectors").select("status").eq("id", connectorId).single();
        if (!current) return jsonResponse({ error: "Not found" }, 404);
        const newStatus = current.status === "connected" ? "disconnected" : "connected";
        const { data, error } = await supabase.from("mcp_connectors").update({ status: newStatus }).eq("id", connectorId).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        await supabase.from("audit_logs").insert({ tenant_id: tenantId, user_id: userId, user_email: email, action: `mcp.${newStatus}`, entity_type: "mcp_connector", entity_id: connectorId });
        return jsonResponse(data);
      }

      // Create new connector
      const body = await req.json();
      if (!body.name || typeof body.name !== "string") return jsonResponse({ error: "name is required" }, 400);
      const allowedFields = ["name", "type", "status", "health", "config", "scopes", "description"];
      const sanitized: Record<string, unknown> = { tenant_id: tenantId };
      for (const key of allowedFields) {
        if (body[key] !== undefined) sanitized[key] = body[key];
      }
      const { data, error } = await supabase.from("mcp_connectors").insert(sanitized).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      await supabase.from("audit_logs").insert({ tenant_id: tenantId, user_id: userId, user_email: email, action: "mcp.created", entity_type: "mcp_connector", entity_id: data.id });
      return jsonResponse(data, 201);
    }

    // PUT — update
    if (req.method === "PUT" && connectorId) {
      const body = await req.json();
      const allowedUpdates = ["name", "type", "status", "health", "config", "scopes", "description"];
      const sanitized: Record<string, unknown> = {};
      for (const key of allowedUpdates) {
        if (body[key] !== undefined) sanitized[key] = body[key];
      }
      if (Object.keys(sanitized).length === 0) return jsonResponse({ error: "No valid fields to update" }, 400);
      const { data: before } = await supabase.from("mcp_connectors").select("*").eq("id", connectorId).single();
      const { data, error } = await supabase.from("mcp_connectors").update(sanitized).eq("id", connectorId).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      const { data: putTenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
      if (putTenantId) await supabase.from("audit_logs").insert({ tenant_id: putTenantId, user_id: userId, user_email: email, action: "mcp.updated", entity_type: "mcp_connector", entity_id: connectorId, before_state: before, after_state: data });
      return jsonResponse(data);
    }

    // DELETE
    if (req.method === "DELETE" && connectorId) {
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
      const { data: before } = await supabase.from("mcp_connectors").select("name, type").eq("id", connectorId).single();
      const { error } = await supabase.from("mcp_connectors").delete().eq("id", connectorId);
      if (error) return jsonResponse({ error: error.message }, 400);
      if (tenantId) await supabase.from("audit_logs").insert({ tenant_id: tenantId, user_id: userId, user_email: email, action: "mcp.deleted", entity_type: "mcp_connector", entity_id: connectorId, before_state: before });
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid request" }, 400);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") return jsonResponse({ error: "Unauthorized" }, 401);
    console.error("mcp-api error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
