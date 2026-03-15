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
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");
  
  return { supabase, userId: data.claims.sub as string, email: (data.claims as any).email as string };
}

async function writeAudit(supabase: any, userId: string, email: string, action: string, entityType: string, entityId?: string, before?: any, after?: any) {
  const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
  if (!tenantId) return;
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId, user_id: userId, user_email: email,
    action, entity_type: entityType, entity_id: entityId,
    before_state: before || null, after_state: after || null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabase, userId, email } = await getAuthClient(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const deviceId = url.searchParams.get("id");

    // GET — list or single
    if (req.method === "GET") {
      if (deviceId) {
        const { data, error } = await supabase.from("devices").select("*").eq("id", deviceId).single();
        if (error) return jsonResponse({ error: error.message }, 404);
        return jsonResponse(data);
      }
      const siteId = url.searchParams.get("site_id");
      const status = url.searchParams.get("status");
      const brand = url.searchParams.get("brand");
      let query = supabase.from("devices").select("*").order("name").limit(500);
      if (siteId) query = query.eq("site_id", siteId);
      if (status) query = query.eq("status", status);
      if (brand) query = query.eq("brand", brand);
      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(data);
    }

    // POST — create
    if (req.method === "POST" && !action) {
      const body = await req.json();
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
      if (!tenantId) return jsonResponse({ error: "No tenant found" }, 403);
      if (!body.name || typeof body.name !== "string") return jsonResponse({ error: "name is required" }, 400);

      const allowedFields = ["name", "brand", "model", "type", "ip_address", "rtsp_url", "site_id", "status", "config", "capabilities"];
      const sanitized: Record<string, unknown> = { tenant_id: tenantId };
      for (const key of allowedFields) {
        if (body[key] !== undefined) sanitized[key] = body[key];
      }

      const { data, error } = await supabase.from("devices").insert(sanitized).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      await writeAudit(supabase, userId, email, "device.created", "device", data.id, null, data);
      return jsonResponse(data, 201);
    }

    // POST — test-connection
    if (req.method === "POST" && action === "test-connection") {
      const body = await req.json();
      // Simulated test — in production, gateway would handle this
      const result = {
        success: true,
        message: `Connection test to ${body.ip_address || "device"} successful (simulated)`,
        latency_ms: Math.floor(Math.random() * 50) + 10,
        protocol: body.brand === "hikvision" ? "ISAPI" : body.brand === "dahua" ? "HTTP-API" : "ONVIF",
        capabilities_detected: { ptz: true, audio: true, smart_events: body.brand !== "generic_onvif" },
      };
      await writeAudit(supabase, userId, email, "device.test_connection", "device", body.device_id || null, null, result);
      return jsonResponse(result);
    }

    // PUT — update
    if (req.method === "PUT" && deviceId) {
      const body = await req.json();
      const allowedUpdates = ["name", "brand", "model", "type", "ip_address", "rtsp_url", "site_id", "status", "config", "capabilities"];
      const sanitized: Record<string, unknown> = {};
      for (const key of allowedUpdates) {
        if (body[key] !== undefined) sanitized[key] = body[key];
      }
      if (Object.keys(sanitized).length === 0) return jsonResponse({ error: "No valid fields to update" }, 400);

      const { data: before } = await supabase.from("devices").select("*").eq("id", deviceId).single();
      const { data, error } = await supabase.from("devices").update(sanitized).eq("id", deviceId).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      await writeAudit(supabase, userId, email, "device.updated", "device", deviceId, before, data);
      return jsonResponse(data);
    }

    // DELETE
    if (req.method === "DELETE" && deviceId) {
      const { data: before } = await supabase.from("devices").select("*").eq("id", deviceId).single();
      const { error } = await supabase.from("devices").delete().eq("id", deviceId);
      if (error) return jsonResponse({ error: error.message }, 400);
      await writeAudit(supabase, userId, email, "device.deleted", "device", deviceId, before, null);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid request" }, 400);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    console.error("devices-api error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
