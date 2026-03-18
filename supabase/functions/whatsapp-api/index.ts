import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getAuthContext, writeAudit } from "../_shared/auth.ts";

// ── WhatsApp Cloud API helper ───────────────────────────────────
async function whatsappRequest(
  phoneNumberId: string,
  accessToken: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; data?: unknown; error?: string; status: number }> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (res.ok) return { ok: true, data, status: res.status };
  return { ok: false, error: data.error?.message || `WhatsApp API ${res.status}`, status: res.status };
}

function getWhatsAppConfig(): { phoneNumberId: string; accessToken: string; businessId: string } | null {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const businessId = Deno.env.get("WHATSAPP_BUSINESS_ID") || "";
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken, businessId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const auth = await getAuthContext(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) return jsonResponse({ error: "Missing action parameter" }, 400);

    const auditCtx = auth.tenantId
      ? { tenantId: auth.tenantId, userId: auth.userId, email: auth.email }
      : null;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── GET actions ────────────────────────────────────────
    if (req.method === "GET") {
      // ── config ───────────────────────────────────────────
      if (action === "config") {
        const wa = getWhatsAppConfig();
        return jsonResponse({
          data: {
            configured: !!wa,
            phoneNumberId: wa?.phoneNumberId ? `***${wa.phoneNumberId.slice(-4)}` : null,
            businessId: wa?.businessId ? `***${wa.businessId.slice(-4)}` : null,
            hasAccessToken: !!wa?.accessToken,
          },
        });
      }

      // ── health ───────────────────────────────────────────
      if (action === "health") {
        const wa = getWhatsAppConfig();
        if (!wa) {
          return jsonResponse({
            data: { ok: false, provider: "whatsapp-cloud", latencyMs: 0, message: "WhatsApp not configured" },
          });
        }

        const start = Date.now();
        const result = await whatsappRequest(wa.phoneNumberId, wa.accessToken, "", "GET");
        const latencyMs = Date.now() - start;

        return jsonResponse({
          data: {
            ok: result.ok,
            provider: "whatsapp-cloud",
            latencyMs,
            message: result.ok ? "WhatsApp Cloud API reachable" : (result.error || "Connection failed"),
          },
        });
      }

      // ── conversations ────────────────────────────────────
      if (action === "conversations") {
        const status = url.searchParams.get("status");
        const phone = url.searchParams.get("phone");
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);

        let query = supabaseAdmin
          .from("whatsapp_conversations")
          .select("*", { count: "exact" });

        if (auth.tenantId) query = query.eq("tenant_id", auth.tenantId);
        if (status) query = query.eq("status", status);
        if (phone) query = query.ilike("phone_number", `%${phone}%`);

        const { data: convos, count, error } = await query
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({
          data: { items: convos || [], total: count || 0, limit, offset },
        });
      }

      // ── conversation (single) ────────────────────────────
      if (action === "conversation") {
        const id = url.searchParams.get("id");
        if (!id) return jsonResponse({ error: "Missing id parameter" }, 400);

        const { data: convo, error } = await supabaseAdmin
          .from("whatsapp_conversations")
          .select("*")
          .eq("id", id)
          .single();

        if (error) return jsonResponse({ error: error.message }, 404);
        return jsonResponse({ data: convo });
      }

      // ── messages ─────────────────────────────────────────
      if (action === "messages") {
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) return jsonResponse({ error: "Missing conversationId" }, 400);

        const limit = parseInt(url.searchParams.get("limit") || "100", 10);

        const { data: messages, error } = await supabaseAdmin
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(limit);

        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ data: messages || [] });
      }

      // ── templates ────────────────────────────────────────
      if (action === "templates") {
        const wa = getWhatsAppConfig();
        if (!wa) return jsonResponse({ error: "WhatsApp not configured" }, 503);

        const result = await whatsappRequest(
          wa.businessId || wa.phoneNumberId,
          wa.accessToken,
          "/message_templates",
          "GET",
        );

        if (!result.ok) return jsonResponse({ error: result.error }, result.status);
        return jsonResponse({ data: (result.data as Record<string, unknown>)?.data || [] });
      }

      return jsonResponse({ error: `Unknown GET action: ${action}` }, 400);
    }

    // ── PUT actions ────────────────────────────────────────
    if (req.method === "PUT") {
      // ── config (save) ────────────────────────────────────
      if (action === "config") {
        // Config is managed via env vars — we store user overrides in tenant settings
        const body = await req.json();
        if (!auth.tenantId) return jsonResponse({ error: "No tenant context" }, 403);

        const { error } = await supabaseAdmin
          .from("tenants")
          .update({
            settings: supabaseAdmin.rpc ? undefined : undefined, // We use jsonb_set via raw
          })
          .eq("id", auth.tenantId);

        // Store whatsapp config in tenant settings
        await supabaseAdmin.rpc("jsonb_set_nested", {
          _table: "tenants",
          _id: auth.tenantId,
          _column: "settings",
          _path: "{whatsapp}",
          _value: JSON.stringify(body),
        }).catch(async () => {
          // Fallback: read-modify-write
          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("settings")
            .eq("id", auth.tenantId!)
            .single();

          const settings = (tenant?.settings || {}) as Record<string, unknown>;
          settings.whatsapp = body;

          await supabaseAdmin
            .from("tenants")
            .update({ settings })
            .eq("id", auth.tenantId!);
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "whatsapp.config_update", "whatsapp_config");
        }

        return jsonResponse({ data: { success: true } });
      }

      return jsonResponse({ error: `Unknown PUT action: ${action}` }, 400);
    }

    // ── POST actions ───────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();

      // ── test ─────────────────────────────────────────────
      if (action === "test") {
        const wa = getWhatsAppConfig();
        if (!wa) return jsonResponse({ error: "WhatsApp not configured" }, 503);

        const to = body.to;
        if (!to) return jsonResponse({ error: "Missing 'to' phone number" }, 400);

        const result = await whatsappRequest(wa.phoneNumberId, wa.accessToken, "/messages", "POST", {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: `AION Vision Hub — Prueba de conexión WhatsApp exitosa. ${new Date().toISOString()}` },
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "whatsapp.test", "whatsapp", undefined, undefined, { to, success: result.ok });
        }

        if (!result.ok) return jsonResponse({ data: { success: false, error: result.error } });
        return jsonResponse({ data: { success: true, messageId: (result.data as Record<string, unknown>)?.messages?.[0]?.id } });
      }

      // ── send ─────────────────────────────────────────────
      if (action === "send") {
        const wa = getWhatsAppConfig();
        if (!wa) return jsonResponse({ error: "WhatsApp not configured" }, 503);

        let payload: Record<string, unknown> = {
          messaging_product: "whatsapp",
          to: body.to,
        };

        if (body.type === "template") {
          payload.type = "template";
          payload.template = {
            name: body.templateName,
            language: { code: body.templateLanguage || "es" },
            ...(body.templateParams?.length
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: body.templateParams.map((p: string) => ({ type: "text", text: p })),
                    },
                  ],
                }
              : {}),
          };
        } else if (body.type === "image" || body.type === "video" || body.type === "document") {
          payload.type = body.type;
          payload[body.type] = {
            link: body.mediaUrl,
            ...(body.caption ? { caption: body.caption } : {}),
          };
        } else if (body.type === "interactive" && body.interactive) {
          payload.type = "interactive";
          payload.interactive = body.interactive;
        } else {
          payload.type = "text";
          payload.text = { body: body.body || "" };
        }

        const result = await whatsappRequest(wa.phoneNumberId, wa.accessToken, "/messages", "POST", payload);

        // Upsert conversation
        if (result.ok && auth.tenantId) {
          const msgId = ((result.data as Record<string, unknown>)?.messages as Array<Record<string, unknown>>)?.[0]?.id;

          // Find or create conversation
          const { data: existing } = await supabaseAdmin
            .from("whatsapp_conversations")
            .select("id")
            .eq("tenant_id", auth.tenantId)
            .eq("phone_number", body.to)
            .eq("status", "active")
            .maybeSingle();

          let conversationId = existing?.id;

          if (!conversationId) {
            const { data: newConvo } = await supabaseAdmin
              .from("whatsapp_conversations")
              .insert({
                tenant_id: auth.tenantId,
                phone_number: body.to,
                status: "active",
                contact_name: body.to,
              })
              .select("id")
              .single();
            conversationId = newConvo?.id;
          }

          if (conversationId) {
            await supabaseAdmin.from("whatsapp_messages").insert({
              conversation_id: conversationId,
              direction: "outbound",
              message_type: payload.type || "text",
              content: body.body || body.templateName || "",
              wa_message_id: msgId,
              status: "sent",
            });
          }

          if (auditCtx) {
            await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "whatsapp.send", "whatsapp_message", msgId as string, undefined, { to: body.to, type: payload.type });
          }
        }

        if (!result.ok) return jsonResponse({ data: { success: false, error: result.error } });
        return jsonResponse({
          data: {
            success: true,
            messageId: ((result.data as Record<string, unknown>)?.messages as Array<Record<string, unknown>>)?.[0]?.id,
          },
        });
      }

      // ── quick-reply ──────────────────────────────────────
      if (action === "quick-reply") {
        const wa = getWhatsAppConfig();
        if (!wa) return jsonResponse({ error: "WhatsApp not configured" }, 503);

        const buttons = (body.buttons || []).slice(0, 3).map((b: { id: string; title: string }) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        }));

        const result = await whatsappRequest(wa.phoneNumberId, wa.accessToken, "/messages", "POST", {
          messaging_product: "whatsapp",
          to: body.to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: body.body },
            action: { buttons },
          },
        });

        if (!result.ok) return jsonResponse({ data: { success: false, error: result.error } });
        return jsonResponse({
          data: {
            success: true,
            messageId: ((result.data as Record<string, unknown>)?.messages as Array<Record<string, unknown>>)?.[0]?.id,
          },
        });
      }

      // ── handoff ──────────────────────────────────────────
      if (action === "handoff") {
        const { conversationId, assignTo, note } = body;
        if (!conversationId) return jsonResponse({ error: "Missing conversationId" }, 400);

        const { error } = await supabaseAdmin
          .from("whatsapp_conversations")
          .update({
            status: "human_handoff",
            assigned_to: assignTo || auth.userId,
            metadata: supabaseAdmin.rpc ? undefined : undefined,
          })
          .eq("id", conversationId);

        if (error) return jsonResponse({ error: error.message }, 500);

        // Add system message about handoff
        await supabaseAdmin.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          direction: "system",
          message_type: "text",
          content: `Conversación transferida a agente humano${assignTo ? ` (${assignTo})` : ""}${note ? `. Nota: ${note}` : ""}`,
          status: "delivered",
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "whatsapp.handoff", "whatsapp_conversation", conversationId, undefined, { assignTo, note });
        }

        return jsonResponse({ data: { success: true, conversationId } });
      }

      // ── close ────────────────────────────────────────────
      if (action === "close") {
        const { conversationId, resolution } = body;
        if (!conversationId) return jsonResponse({ error: "Missing conversationId" }, 400);

        const { error } = await supabaseAdmin
          .from("whatsapp_conversations")
          .update({
            status: "closed",
            closed_at: new Date().toISOString(),
          })
          .eq("id", conversationId);

        if (error) return jsonResponse({ error: error.message }, 500);

        await supabaseAdmin.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          direction: "system",
          message_type: "text",
          content: `Conversación cerrada${resolution ? `. Resolución: ${resolution}` : ""}`,
          status: "delivered",
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "whatsapp.close", "whatsapp_conversation", conversationId, undefined, { resolution });
        }

        return jsonResponse({ data: { success: true, conversationId } });
      }

      // ── sync-templates ───────────────────────────────────
      if (action === "sync-templates") {
        const wa = getWhatsAppConfig();
        if (!wa) return jsonResponse({ error: "WhatsApp not configured" }, 503);

        const result = await whatsappRequest(
          wa.businessId || wa.phoneNumberId,
          wa.accessToken,
          "/message_templates",
          "GET",
        );

        if (!result.ok) return jsonResponse({ error: result.error }, result.status);

        const templates = ((result.data as Record<string, unknown>)?.data || []) as Array<Record<string, unknown>>;

        // Store templates in tenant settings
        if (auth.tenantId) {
          const { data: tenant } = await supabaseAdmin
            .from("tenants")
            .select("settings")
            .eq("id", auth.tenantId)
            .single();

          const settings = (tenant?.settings || {}) as Record<string, unknown>;
          settings.whatsapp_templates = templates.map((t) => ({
            name: t.name,
            status: t.status,
            category: t.category,
            language: t.language,
          }));

          await supabaseAdmin
            .from("tenants")
            .update({ settings })
            .eq("id", auth.tenantId);
        }

        return jsonResponse({
          data: { synced: templates.length, templates: templates.map((t) => ({ name: t.name, status: t.status, category: t.category })) },
        });
      }

      return jsonResponse({ error: `Unknown POST action: ${action}` }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    console.error("whatsapp-api error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
