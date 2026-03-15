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
    // This function can be called internally (from event triggers) or by authenticated users
    const authHeader = req.headers.get("Authorization");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Manual trigger by authenticated user — send test alert
    if (action === "test" && authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
      if (authErr || !claims?.claims) return jsonResponse({ error: "Unauthorized" }, 401);

      return jsonResponse({
        success: true,
        message: "Test alert processed. In production, email would be sent to configured recipients.",
        simulated: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Process incoming event for email notification
    if (req.method === "POST") {
      // Require authentication for POST
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const postToken = authHeader.replace("Bearer ", "");
      const { data: postClaims, error: postAuthErr } = await supabaseUser.auth.getClaims(postToken);
      if (postAuthErr || !postClaims?.claims) return jsonResponse({ error: "Unauthorized" }, 401);
      const callerUserId = postClaims.claims.sub as string;

      // Get caller's tenant
      const { data: callerTenantId } = await supabaseUser.rpc("get_user_tenant_id", { _user_id: callerUserId });
      if (!callerTenantId) return jsonResponse({ error: "No tenant found" }, 403);

      const body = await req.json();
      const { event_id, severity, title, event_type, site_id, device_id } = body;

      if (!event_id || !severity) {
        return jsonResponse({ error: "Missing event_id or severity" }, 400);
      }

      // Only process critical and high severity events
      if (severity !== "critical" && severity !== "high") {
        return jsonResponse({ skipped: true, reason: "Event severity below alert threshold" });
      }

      // Get tenant notification settings — scoped to caller's tenant
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("name, settings, id")
        .eq("id", callerTenantId)
        .single();

      const settings = (tenant?.settings || {}) as Record<string, any>;
      const notifications = settings.notifications || {};

      // Check if critical event notifications are enabled
      const shouldNotify =
        (severity === "critical" && notifications.critical_events !== false) ||
        (severity === "high" && notifications.high_severity !== false);

      if (!shouldNotify) {
        return jsonResponse({ skipped: true, reason: "Notification disabled for this severity" });
      }

      // Get device and site info for the email
      let deviceName = "Unknown Device";
      let siteName = "Unknown Site";

      if (device_id) {
        const { data: device } = await supabaseAdmin
          .from("devices")
          .select("name")
          .eq("id", device_id)
          .eq("tenant_id", callerTenantId)
          .single();
        if (device) deviceName = device.name;
      }

      if (site_id) {
        const { data: site } = await supabaseAdmin
          .from("sites")
          .select("name")
          .eq("id", site_id)
          .eq("tenant_id", callerTenantId)
          .single();
        if (site) siteName = site.name;
      }

      // Get active user emails scoped to caller's tenant
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("tenant_id", callerTenantId)
        .eq("is_active", true);

      const recipients: string[] = [];
      if (profiles) {
        for (const p of profiles) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
          if (userData?.user?.email) {
            recipients.push(userData.user.email);
          }
        }
      }

      // Log the alert action
      const alertPayload = {
        event_id,
        severity,
        title,
        event_type,
        device: deviceName,
        site: siteName,
        tenant: tenant?.name || "AION Vision Hub",
        recipients_count: recipients.length,
        timestamp: new Date().toISOString(),
        // In production, this would integrate with an email service
        // For now, we log the alert and store it
        email_subject: `🚨 [${severity.toUpperCase()}] ${title} — ${deviceName}`,
        email_body: `
Security Alert — ${tenant?.name || "AION Vision Hub"}

Event: ${title}
Severity: ${severity.toUpperCase()}
Type: ${event_type || "Unknown"}
Device: ${deviceName}
Site: ${siteName}
Time: ${new Date().toISOString()}

This is an automated alert from AION Vision Hub. 
Please review this event in the platform immediately.
        `.trim(),
      };

      // Store alert in audit log — scoped to caller's tenant
      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: callerTenantId,
        user_id: callerUserId,
        user_email: (postClaims.claims as any).email || "system@aion-hub.local",
        action: "email_alert_sent",
        entity_type: "event",
        entity_id: event_id,
        after_state: alertPayload,
      });

      return jsonResponse({
        success: true,
        alert: alertPayload,
        message: `Alert processed for ${recipients.length} recipients. Email delivery requires email domain configuration.`,
      });
    }

    // GET — list recent alerts from audit log
    if (req.method === "GET" && authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
      if (authErr || !claims?.claims) return jsonResponse({ error: "Unauthorized" }, 401);

      const { data: alerts } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action", "email_alert_sent")
        .order("created_at", { ascending: false })
        .limit(50);

      return jsonResponse({ alerts: alerts || [] });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("event-alerts error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
