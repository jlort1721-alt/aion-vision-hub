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

async function writeAudit(supabase: any, tenantId: string, userId: string, email: string, action: string, entityType: string, entityId?: string, before?: any, after?: any) {
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId, user_id: userId, user_email: email,
    action, entity_type: entityType, entity_id: entityId,
    before_state: before || null, after_state: after || null,
  });
}

// Sanitize comment content to prevent XSS
function sanitizeText(text: string): string {
  if (typeof text !== "string") return "";
  return text.replace(/[<>]/g, "").slice(0, 5000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabase, userId, email } = await getAuthClient(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const incidentId = url.searchParams.get("id");

    // Resolve tenant for audit logging
    const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
    if (!tenantId) return jsonResponse({ error: "No tenant found" }, 403);

    // GET
    if (req.method === "GET") {
      if (incidentId) {
        const { data, error } = await supabase.from("incidents").select("*").eq("id", incidentId).single();
        if (error) return jsonResponse({ error: "Incident not found" }, 404);
        return jsonResponse(data);
      }
      let query = supabase.from("incidents").select("*").order("created_at", { ascending: false });
      const status = url.searchParams.get("status");
      const priority = url.searchParams.get("priority");
      if (status) query = query.eq("status", status);
      if (priority) query = query.eq("priority", priority);
      query = query.limit(500);
      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(data);
    }

    // POST — create or action
    if (req.method === "POST") {
      if (action === "comment" && incidentId) {
        const body = await req.json();
        const content = sanitizeText(body.content);
        if (!content) return jsonResponse({ error: "Comment content is required" }, 400);

        const { data: incident } = await supabase.from("incidents").select("comments").eq("id", incidentId).single();
        if (!incident) return jsonResponse({ error: "Not found" }, 404);
        const comments = Array.isArray(incident.comments) ? incident.comments : [];
        const newComment = { id: crypto.randomUUID(), user_id: userId, user_name: email, content, created_at: new Date().toISOString() };
        comments.push(newComment);
        const { data, error } = await supabase.from("incidents").update({ comments }).eq("id", incidentId).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        await writeAudit(supabase, tenantId, userId, email, "incident.comment_added", "incident", incidentId, null, { comment: newComment });
        return jsonResponse(data);
      }

      if (action === "close" && incidentId) {
        const { data: before } = await supabase.from("incidents").select("*").eq("id", incidentId).single();
        const { data, error } = await supabase.from("incidents").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", incidentId).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        await writeAudit(supabase, tenantId, userId, email, "incident.closed", "incident", incidentId, before, data);
        return jsonResponse(data);
      }

      if (action === "ai-summary" && incidentId) {
        const { data: incident } = await supabase.from("incidents").select("*").eq("id", incidentId).single();
        if (!incident) return jsonResponse({ error: "Not found" }, 404);
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI not configured" }, 503);
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Summarize this security incident for an operations report. Be concise, factual, and include timeline." },
              { role: "user", content: `Incident: ${incident.title}\nDescription: ${incident.description}\nPriority: ${incident.priority}\nStatus: ${incident.status}\nCreated: ${incident.created_at}` },
            ],
          }),
        });
        if (!aiResp.ok) return jsonResponse({ error: "AI summary generation failed" }, 502);
        const aiData = await aiResp.json();
        const summary = aiData.choices?.[0]?.message?.content || "Summary unavailable";
        const { data, error } = await supabase.from("incidents").update({ ai_summary: summary }).eq("id", incidentId).select().single();
        if (error) return jsonResponse({ error: error.message }, 400);
        await writeAudit(supabase, tenantId, userId, email, "incident.ai_summary", "incident", incidentId, null, { ai_summary: summary.slice(0, 200) });
        return jsonResponse(data);
      }

      // Default: create incident
      const body = await req.json();
      // Validate required fields
      if (!body.title || typeof body.title !== "string") return jsonResponse({ error: "title is required" }, 400);
      if (!body.description || typeof body.description !== "string") return jsonResponse({ error: "description is required" }, 400);

      const allowedFields = ["title", "description", "priority", "site_id", "event_ids", "assigned_to"];
      const sanitized: Record<string, unknown> = { tenant_id: tenantId, created_by: userId, status: "open" };
      for (const key of allowedFields) {
        if (body[key] !== undefined) sanitized[key] = body[key];
      }

      const { data, error } = await supabase.from("incidents").insert(sanitized).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      await writeAudit(supabase, tenantId, userId, email, "incident.created", "incident", data.id, null, data);
      return jsonResponse(data, 201);
    }

    // PUT — update
    if (req.method === "PUT" && incidentId) {
      const body = await req.json();
      const allowedUpdates = ["title", "description", "priority", "status", "assigned_to", "site_id"];
      const sanitized: Record<string, unknown> = {};
      for (const key of allowedUpdates) {
        if (body[key] !== undefined) sanitized[key] = body[key];
      }
      if (Object.keys(sanitized).length === 0) return jsonResponse({ error: "No valid fields to update" }, 400);

      const { data: before } = await supabase.from("incidents").select("*").eq("id", incidentId).single();
      const { data, error } = await supabase.from("incidents").update(sanitized).eq("id", incidentId).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      await writeAudit(supabase, tenantId, userId, email, "incident.updated", "incident", incidentId, before, data);
      return jsonResponse(data);
    }

    return jsonResponse({ error: "Invalid request" }, 400);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") return jsonResponse({ error: "Unauthorized" }, 401);
    console.error("incidents-api error:", e);
    return jsonResponse({ error: "An error occurred" }, 500);
  }
});
