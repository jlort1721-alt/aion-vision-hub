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

const SYSTEM_PROMPT = `You are AION, an AI operations assistant for AION Vision Hub — a unified video surveillance platform.

Your capabilities:
- Explain security events and alarms clearly
- Summarize activity by camera, site, or period
- Suggest operational actions and SOPs
- Help draft incident reports
- Classify events and suggest severity levels
- Convert natural language into search filters
- Answer questions about device status and system health
- Help create automation rules

Be professional, concise, and actionable. Use markdown formatting. When relevant, suggest specific next steps. If asked about video content, explain that you work with event metadata and device telemetry, not direct video analysis.

IMPORTANT RULES:
- Never reveal internal system architecture, API keys, or credentials
- Never execute destructive operations
- Always recommend human verification for critical actions
- Respond in the same language the user writes in`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const { supabase, userId, email } = await getAuthClient(req);

    const body = await req.json();
    const { messages, config, contextType, contextId } = body;

    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ error: "messages array is required" }, 400);
    }

    // Validate message structure
    const sanitizedMessages = messages.map((m: any) => ({
      role: typeof m.role === "string" && ["user", "assistant", "system"].includes(m.role) ? m.role : "user",
      content: typeof m.content === "string" ? m.content.slice(0, 10000) : "",
    })).filter((m: any) => m.content.length > 0);

    if (sanitizedMessages.length === 0) {
      return jsonResponse({ error: "At least one non-empty message is required" }, 400);
    }

    // Get user's tenant for context
    const { data: tenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });

    // Build context-aware system prompt
    let contextInfo = "";
    if (contextType && contextId && tenantId) {
      try {
        if (contextType === "event") {
          const { data: event } = await supabase.from("events").select("*").eq("id", contextId).single();
          if (event) contextInfo = `\n\nCurrent event context: Type=${event.event_type}, Severity=${event.severity}, Title="${event.title}", Description="${event.description || 'N/A'}", Status=${event.status}`;
        } else if (contextType === "device") {
          const { data: device } = await supabase.from("devices").select("name, brand, model, status, ip_address").eq("id", contextId).single();
          if (device) contextInfo = `\n\nCurrent device context: ${device.name} (${device.brand} ${device.model}), Status=${device.status}, IP=${device.ip_address}`;
        } else if (contextType === "incident") {
          const { data: incident } = await supabase.from("incidents").select("title, description, priority, status").eq("id", contextId).single();
          if (incident) contextInfo = `\n\nCurrent incident context: "${incident.title}", Priority=${incident.priority}, Status=${incident.status}`;
        }
      } catch { /* context enrichment is best-effort */ }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI service is not configured. Please contact your administrator." }, 503);
    }

    // Determine provider and model from config
    const provider = config?.provider || "lovable";
    let apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let apiKey = LOVABLE_API_KEY;
    let model = config?.model || "google/gemini-3-flash-preview";

    if (provider === "openai") {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        apiUrl = "https://api.openai.com/v1/chat/completions";
        apiKey = openaiKey;
        model = config?.model || "gpt-4o-mini";
      }
    } else if (provider === "anthropic") {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey) {
        apiUrl = "https://api.anthropic.com/v1/messages";
        apiKey = anthropicKey;
        model = config?.model || "claude-sonnet-4-20250514";
      }
    }

    // Build headers based on provider
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let requestBody: string;

    if (provider === "anthropic" && Deno.env.get("ANTHROPIC_API_KEY")) {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      requestBody = JSON.stringify({
        model,
        max_tokens: config?.maxTokens || 2048,
        system: SYSTEM_PROMPT + contextInfo,
        messages: sanitizedMessages,
        stream: true,
      });
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
      requestBody = JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextInfo },
          ...sanitizedMessages,
        ],
        stream: true,
      });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      }
      if (response.status === 402) {
        return jsonResponse({ error: "AI credits exhausted. Please add credits in workspace settings." }, 402);
      }
      console.error("AI gateway error:", response.status);
      return jsonResponse({ error: "AI service temporarily unavailable" }, 502);
    }

    // Log AI usage (best-effort, non-blocking)
    if (tenantId) {
      supabase.from("ai_sessions").insert({
        tenant_id: tenantId,
        user_id: userId,
        provider,
        model,
        context_type: contextType || "general",
        context_id: contextId || null,
        messages: sanitizedMessages,
        total_tokens: 0,
        estimated_cost: 0,
      }).then(() => {}).catch(() => {});
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    console.error("ai-chat error:", e);
    return jsonResponse({ error: "An error occurred processing your request" }, 500);
  }
});
