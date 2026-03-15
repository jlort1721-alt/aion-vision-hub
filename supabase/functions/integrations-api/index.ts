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
    const integrationId = url.searchParams.get("id");

    if (req.method === "GET") {
      if (integrationId) {
        const { data, error } = await supabase.from("integrations").select("*").eq("id", integrationId).single();
        if (error) return jsonResponse({ error: error.message }, 404);
        return jsonResponse(data);
      }
      const { data, error } = await supabase.from("integrations").select("*").order("name");
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(data);
    }

    if (req.method === "POST") {
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
      if (!tenantId) return jsonResponse({ error: "No tenant" }, 403);

      if (action === "test" && integrationId) {
        // Simulated test connection
        const result = { success: true, message: "Connection successful (simulated)", latency_ms: Math.floor(Math.random() * 80) + 15 };
        await supabase.from("audit_logs").insert({ tenant_id: tenantId, user_id: userId, user_email: email, action: "integration.test", entity_type: "integration", entity_id: integrationId });
        return jsonResponse(result);
      }

      if (action === "toggle" && integrationId) {
        const { data: current } = await supabase.from("integrations").select("status").eq("id", integrationId).single();
        if (!current) return jsonResponse({ error: "Not found" }, 404);
        const newStatus = current.status === "active" ? "inactive" : "active";
        const { data, error } = await supabase.from("integrations").update({ status: newStatus, last_sync: newStatus === "active" ? new Date().toISOString() : null }).eq("id", integrationId).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        await supabase.from("audit_logs").insert({ tenant_id: tenantId, user_id: userId, user_email: email, action: `integration.${newStatus}`, entity_type: "integration", entity_id: integrationId });
        return jsonResponse(data);
      }

      const body = await req.json();
      if (!body.name || typeof body.name !== "string") return jsonResponse({ error: "name is required" }, 400);
      const allowedFields = ["name", "type", "status", "config", "description", "webhook_url"];
      const sanitized: Record<string, unknown> = { tenant_id: tenantId };
      for (const key of allowedFields) {
        if (body[key] !== undefined) sanitized[key] = body[key];
      }
      const { data, error } = await supabase.from("integrations").insert(sanitized).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      await supabase.from("audit_logs").insert({ tenant_id: tenantId, user_id: userId, user_email: email, action: "integration.created", entity_type: "integration", entity_id: data.id });
      return jsonResponse(data, 201);
    }

    if (req.method === "PUT" && integrationId) {
      const body = await req.json();
      const allowedUpdates = ["name", "type", "status", "config", "description", "webhook_url"];
      const sanitized: Record<string, unknown> = {};
      for (const key of allowedUpdates) {
        if (body[key] !== undefined) sanitized[key] = body[key];
      }
      if (Object.keys(sanitized).length === 0) return jsonResponse({ error: "No valid fields to update" }, 400);
      const { data: before } = await supabase.from("integrations").select("*").eq("id", integrationId).single();
      const { data, error } = await supabase.from("integrations").update(sanitized).eq("id", integrationId).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      const { data: putTenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
      if (putTenantId) await supabase.from("audit_logs").insert({ tenant_id: putTenantId, user_id: userId, user_email: email, action: "integration.updated", entity_type: "integration", entity_id: integrationId, before_state: before, after_state: data });
      return jsonResponse(data);
    }

    if (req.method === "DELETE" && integrationId) {
      const { data: delTenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
      const { data: before } = await supabase.from("integrations").select("name, type").eq("id", integrationId).single();
      const { error } = await supabase.from("integrations").delete().eq("id", integrationId);
      if (error) return jsonResponse({ error: error.message }, 400);
      if (delTenantId) await supabase.from("audit_logs").insert({ tenant_id: delTenantId, user_id: userId, user_email: email, action: "integration.deleted", entity_type: "integration", entity_id: integrationId, before_state: before });
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid request" }, 400);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") return jsonResponse({ error: "Unauthorized" }, 401);
    console.error("integrations-api error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
