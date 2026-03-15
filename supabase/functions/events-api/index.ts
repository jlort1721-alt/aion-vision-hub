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
    const eventId = url.searchParams.get("id");

    // GET — list with filters
    if (req.method === "GET") {
      if (eventId) {
        const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
        if (error) return jsonResponse({ error: error.message }, 404);
        return jsonResponse(data);
      }
      let query = supabase.from("events").select("*").order("created_at", { ascending: false });
      const severity = url.searchParams.get("severity");
      const status = url.searchParams.get("status");
      const siteId = url.searchParams.get("site_id");
      const deviceId = url.searchParams.get("device_id");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "200") || 200, 1000);
      if (severity) query = query.eq("severity", severity);
      if (status) query = query.eq("status", status);
      if (siteId) query = query.eq("site_id", siteId);
      if (deviceId) query = query.eq("device_id", deviceId);
      query = query.limit(limit);
      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(data);
    }

    // POST — acknowledge, resolve, assign, dismiss
    if (req.method === "POST" && eventId && action) {
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
      let updatePayload: Record<string, unknown> = {};

      switch (action) {
        case "acknowledge":
          updatePayload = { status: "acknowledged" };
          break;
        case "resolve":
          updatePayload = { status: "resolved", resolved_by: userId, resolved_at: new Date().toISOString() };
          break;
        case "assign": {
          const body = await req.json();
          updatePayload = { assigned_to: body.assigned_to, status: "investigating" };
          break;
        }
        case "dismiss":
          updatePayload = { status: "dismissed" };
          break;
        case "ai-summary": {
          // Call AI to generate summary
          const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
          if (!event) return jsonResponse({ error: "Event not found" }, 404);

          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI not configured" }, 500);

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You are a surveillance operations AI. Summarize security events concisely in 2-3 sentences. Include severity assessment and recommended action." },
                { role: "user", content: `Summarize this event: Type: ${event.event_type}, Severity: ${event.severity}, Title: ${event.title}, Description: ${event.description || "N/A"}, Device: ${event.device_id}` },
              ],
            }),
          });
          if (!aiResponse.ok) return jsonResponse({ error: "AI summary failed" }, 502);
          const aiData = await aiResponse.json();
          const summary = aiData.choices?.[0]?.message?.content || "Summary unavailable";
          updatePayload = { ai_summary: summary };
          break;
        }
        default:
          return jsonResponse({ error: `Unknown action: ${action}` }, 400);
      }

      const { data: before } = await supabase.from("events").select("*").eq("id", eventId).single();
      const { data, error } = await supabase.from("events").update(updatePayload).eq("id", eventId).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);

      // Audit
      await supabase.from("audit_logs").insert({
        tenant_id: tenantId, user_id: userId, user_email: email,
        action: `event.${action}`, entity_type: "event", entity_id: eventId,
        before_state: before, after_state: data,
      });

      return jsonResponse(data);
    }

    return jsonResponse({ error: "Invalid request" }, 400);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") return jsonResponse({ error: "Unauthorized" }, 401);
    console.error("events-api error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
