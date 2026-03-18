import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getAuthContext, writeAudit } from "../_shared/auth.ts";

const corsHeaders = getCorsHeaders();

// ── Resend email sending helper ─────────────────────────────────
async function sendViaResend(params: {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: string; content_type: string }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { success: false, error: "RESEND_API_KEY not configured" };

  const body: Record<string, unknown> = {
    from: params.from,
    to: params.to,
    subject: params.subject,
  };
  if (params.html) body.html = params.html;
  if (params.text) body.text = params.text;
  if (params.reply_to) body.reply_to = params.reply_to;
  if (params.cc?.length) body.cc = params.cc;
  if (params.bcc?.length) body.bcc = params.bcc;
  if (params.attachments?.length) {
    body.attachments = params.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      content_type: a.content_type,
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (res.ok) return { success: true, messageId: data.id };
  return { success: false, error: data.message || `Resend error ${res.status}` };
}

// ── Email templates ─────────────────────────────────────────────
function eventAlertHtml(p: Record<string, unknown>): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#dc2626">Alerta de Seguridad — ${p.severity?.toString().toUpperCase()}</h2>
  <p><strong>Evento:</strong> ${p.title}</p>
  <p><strong>Tipo:</strong> ${p.eventType}</p>
  <p><strong>Dispositivo:</strong> ${p.deviceName || "N/A"}</p>
  <p><strong>Sitio:</strong> ${p.siteName || "N/A"}</p>
  <p><strong>Descripción:</strong> ${p.description || ""}</p>
  <p><strong>Hora:</strong> ${p.timestamp}</p>
  ${p.snapshotUrl ? `<img src="${p.snapshotUrl}" alt="snapshot" style="max-width:100%;border-radius:8px"/>` : ""}
  <hr/><p style="color:#6b7280;font-size:12px">AION Vision Hub — Notificación automática</p>
</div>`;
}

function incidentReportHtml(p: Record<string, unknown>): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#f59e0b">Reporte de Incidente</h2>
  <p><strong>ID:</strong> ${p.incidentId}</p>
  <p><strong>Título:</strong> ${p.title}</p>
  <p><strong>Estado:</strong> ${p.status}</p>
  <p><strong>Prioridad:</strong> ${p.priority}</p>
  <p><strong>Resumen:</strong> ${p.summary}</p>
  ${p.assignedTo ? `<p><strong>Asignado a:</strong> ${p.assignedTo}</p>` : ""}
  ${p.eventsCount ? `<p><strong>Eventos asociados:</strong> ${p.eventsCount}</p>` : ""}
  <p><strong>Creado:</strong> ${p.createdAt}</p>
  <hr/><p style="color:#6b7280;font-size:12px">AION Vision Hub — Notificación automática</p>
</div>`;
}

function periodicReportHtml(p: Record<string, unknown>): string {
  const topTypes = (p.topEventTypes as Array<{ type: string; count: number }>) || [];
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2563eb">Informe Periódico — ${p.reportName}</h2>
  <p><strong>Período:</strong> ${p.period}</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td>Total eventos</td><td style="text-align:right"><strong>${p.totalEvents}</strong></td></tr>
    <tr><td>Eventos críticos</td><td style="text-align:right;color:#dc2626"><strong>${p.criticalEvents}</strong></td></tr>
    <tr><td>Incidentes activos</td><td style="text-align:right"><strong>${p.activeIncidents}</strong></td></tr>
    <tr><td>Dispositivos online</td><td style="text-align:right"><strong>${p.devicesOnline}/${p.devicesTotal}</strong></td></tr>
  </table>
  ${topTypes.length ? `<h3>Tipos de evento más frecuentes</h3><ul>${topTypes.map((t) => `<li>${t.type}: ${t.count}</li>`).join("")}</ul>` : ""}
  <hr/><p style="color:#6b7280;font-size:12px">AION Vision Hub — Reporte automático</p>
</div>`;
}

function evidencePackageHtml(p: Record<string, unknown>): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#7c3aed">Paquete de Evidencia</h2>
  <p><strong>Evento:</strong> ${p.title} (${p.eventId})</p>
  <p><strong>Tipo:</strong> ${p.eventType}</p>
  <p><strong>Dispositivo:</strong> ${p.deviceName}</p>
  <p><strong>Sitio:</strong> ${p.siteName}</p>
  <p><strong>Descripción:</strong> ${p.description || ""}</p>
  <p><strong>Hora:</strong> ${p.timestamp}</p>
  ${p.recipientName ? `<p><strong>Destinatario:</strong> ${p.recipientName}</p>` : ""}
  <p><strong>Exportado por:</strong> ${p.exportedBy}</p>
  <p style="color:#6b7280">Archivos adjuntos incluidos en este correo.</p>
  <hr/><p style="color:#6b7280;font-size:12px">AION Vision Hub — Evidencia digital</p>
</div>`;
}

// ── In-memory send log (edge function is short-lived, so this resets per invocation) ──
const sendLog: Array<Record<string, unknown>> = [];

const FROM_EMAIL = Deno.env.get("EMAIL_FROM_ADDRESS") || "noreply@aionvisionhub.com";
const FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") || "AION Vision Hub";
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const auth = await getAuthContext(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const auditCtx = auth.tenantId
      ? { tenantId: auth.tenantId, userId: auth.userId, email: auth.email }
      : null;

    // ── GET /email-api (no action) — health check ──────────
    if (req.method === "GET" && !action) {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      const configured = !!apiKey;
      let ok = false;
      let latencyMs = 0;
      let message = "No email provider configured";

      if (configured) {
        const start = Date.now();
        try {
          const res = await fetch("https://api.resend.com/domains", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          latencyMs = Date.now() - start;
          ok = res.ok;
          message = ok ? "Resend API reachable" : `Resend returned ${res.status}`;
        } catch (e) {
          latencyMs = Date.now() - start;
          message = e instanceof Error ? e.message : "Connection failed";
        }
      }

      return jsonResponse({
        data: { configured, provider: configured ? "resend" : "none", ok, latencyMs, message },
      });
    }

    // ── GET /email-api?action=logs ─────────────────────────
    if (req.method === "GET" && action === "logs") {
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      // Fetch from audit_logs since edge function memory doesn't persist
      const { data: logs } = await auth.supabase
        .from("audit_logs")
        .select("id, action, after_state, created_at")
        .like("action", "email.%")
        .order("created_at", { ascending: false })
        .limit(limit);

      const formatted = (logs || []).map((l: Record<string, unknown>) => {
        const state = (l.after_state || {}) as Record<string, unknown>;
        return {
          id: l.id,
          provider: state.provider || "resend",
          action: (l.action as string).replace("email.", ""),
          to: state.to || [],
          subject: state.subject || "",
          success: state.success ?? true,
          messageId: state.messageId,
          error: state.error,
          latencyMs: state.latencyMs || 0,
          timestamp: l.created_at,
        };
      });

      return jsonResponse({ data: formatted });
    }

    // ── POST actions ───────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();

      // ── action=test ──────────────────────────────────────
      if (action === "test") {
        const to = body.to || FROM_EMAIL;
        const result = await sendViaResend({
          from: FROM,
          to: [to],
          subject: "AION Vision Hub — Prueba de correo",
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2>Conexión exitosa</h2><p>Este correo confirma que el servicio de email está configurado correctamente.</p><p style="color:#6b7280;font-size:12px">${new Date().toISOString()}</p></div>`,
          text: `AION Vision Hub — Prueba de correo exitosa. ${new Date().toISOString()}`,
        });

        // Health check data
        const apiKey = Deno.env.get("RESEND_API_KEY");
        const healthCheck = { ok: !!apiKey, provider: apiKey ? "resend" : "none", latencyMs: 0, message: apiKey ? "configured" : "not configured" };

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "email.test_connection", "email", undefined, undefined, { ...result, to });
        }

        return jsonResponse({ data: { ...result, healthCheck } });
      }

      // ── action=send (generic) ────────────────────────────
      if (action === "send") {
        const result = await sendViaResend({
          from: FROM,
          to: body.to,
          subject: body.subject,
          html: body.html,
          text: body.text,
          reply_to: body.replyTo,
          cc: body.cc,
          bcc: body.bcc,
          attachments: body.attachments,
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "email.generic", "email", undefined, undefined, { ...result, to: body.to, subject: body.subject });
        }

        return jsonResponse({ data: result });
      }

      // ── action=event-alert ───────────────────────────────
      if (action === "event-alert") {
        const html = eventAlertHtml(body);
        const result = await sendViaResend({
          from: FROM,
          to: body.to,
          subject: `[${(body.severity || "INFO").toUpperCase()}] ${body.title} — ${body.deviceName || "Sistema"}`,
          html,
          text: `Alerta: ${body.title} | Severidad: ${body.severity} | Dispositivo: ${body.deviceName || "N/A"} | Sitio: ${body.siteName || "N/A"}`,
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "email.event_alert", "email", undefined, undefined, { ...result, to: body.to, subject: body.title, severity: body.severity });
        }

        return jsonResponse({ data: result });
      }

      // ── action=incident-report ───────────────────────────
      if (action === "incident-report") {
        const html = incidentReportHtml(body);
        const result = await sendViaResend({
          from: FROM,
          to: body.to,
          subject: `Incidente [${body.priority}] — ${body.title}`,
          html,
          text: `Incidente: ${body.title} | Estado: ${body.status} | Prioridad: ${body.priority}`,
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "email.incident_report", "email", body.incidentId, undefined, { ...result, to: body.to, priority: body.priority });
        }

        return jsonResponse({ data: result });
      }

      // ── action=periodic-report ───────────────────────────
      if (action === "periodic-report") {
        const html = periodicReportHtml(body);
        const result = await sendViaResend({
          from: FROM,
          to: body.to,
          subject: `Informe: ${body.reportName} — ${body.period}`,
          html,
          text: `${body.reportName} | Eventos: ${body.totalEvents} | Críticos: ${body.criticalEvents} | Incidentes: ${body.activeIncidents}`,
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "email.periodic_report", "email", undefined, undefined, { ...result, to: body.to, reportName: body.reportName });
        }

        return jsonResponse({ data: result });
      }

      // ── action=evidence-package ──────────────────────────
      if (action === "evidence-package") {
        const html = evidencePackageHtml(body);
        const result = await sendViaResend({
          from: FROM,
          to: body.to,
          subject: `Evidencia: ${body.title} — ${body.deviceName} (${body.siteName})`,
          html,
          text: `Paquete de evidencia: ${body.title} | Evento: ${body.eventId} | Exportado por: ${body.exportedBy}`,
          attachments: body.attachments,
        });

        if (auditCtx) {
          await writeAudit(auth.supabase, auditCtx.tenantId, auditCtx.userId, auditCtx.email, "email.evidence_package", "email", body.eventId, undefined, { ...result, to: body.to, eventId: body.eventId });
        }

        return jsonResponse({ data: result });
      }

      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    console.error("email-api error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
