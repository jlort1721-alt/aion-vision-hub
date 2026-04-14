/**
 * Twilio Scheduled Notifications Worker
 *
 * Periodically checks notification rules and fires automated notifications.
 * Handles: pending tickets >24h, overdue services >7d, daily summaries, monthly reminders.
 */

import { createLogger } from "@aion/common-utils";
import { db } from "../db/client.js";
import { sql, eq } from "drizzle-orm";
import { twilioNotificationRules } from "../db/schema/index.js";
import twilioService from "../services/twilio.service.js";

const logger = createLogger({ name: "twilio-notifications" });

export class TwilioNotificationWorker {
  private intervalId: NodeJS.Timeout | null = null;

  start(intervalMs = 900_000) {
    // 15 minutes
    if (!twilioService.isConfigured()) {
      logger.info("Twilio not configured — notification worker disabled");
      return;
    }
    logger.info({ interval: intervalMs }, "Twilio notification worker started");
    this.intervalId = setInterval(() => this.run(), intervalMs);
    // Run once on startup after 30s delay
    setTimeout(() => this.run(), 30_000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    logger.info("Twilio notification worker stopped");
  }

  private async run() {
    try {
      // Find active rules whose cooldown has expired
      const now = new Date();
      const rules = await db
        .select()
        .from(twilioNotificationRules)
        .where(eq(twilioNotificationRules.isActive, true));

      for (const rule of rules) {
        // Check cooldown
        if (rule.lastFiredAt) {
          const cooldownEnd = new Date(
            rule.lastFiredAt.getTime() + rule.cooldownMinutes * 60_000,
          );
          if (now < cooldownEnd) continue;
        }

        try {
          await this.processRule(rule);
        } catch (err: any) {
          logger.error(
            { ruleId: rule.id, error: err.message },
            "Failed to process notification rule",
          );
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message }, "Notification worker run failed");
    }
  }

  private async processRule(rule: typeof twilioNotificationRules.$inferSelect) {
    const recipientPhone = rule.recipientOverride;
    if (!recipientPhone) {
      // No specific phone to send to — skip for now
      // In production, resolve recipient from recipientType → user lookup
      return;
    }

    let shouldFire = false;
    let templateVars: Record<string, string> = {};

    switch (rule.eventType) {
      case "ticket_pending_24h": {
        const rows = await db.execute(sql`
          SELECT count(*) as cnt FROM database_records
          WHERE category ='service_tickets'
            AND data->>'status' = 'Pendiente'
            AND created_at < NOW() - INTERVAL '24 hours'
        `);
        const count = Number((rows[0] as any)?.cnt || 0);
        if (count > 0) {
          shouldFire = true;
          templateVars = { count: String(count) };
        }
        break;
      }

      case "service_pending_7d": {
        const rows = await db.execute(sql`
          SELECT count(*) as cnt FROM database_records
          WHERE category ='tech_services'
            AND data->>'status' = 'PENDIENTE'
            AND created_at < NOW() - INTERVAL '7 days'
        `);
        const count = Number((rows[0] as any)?.cnt || 0);
        if (count > 0) {
          shouldFire = true;
          templateVars = { count: String(count) };
        }
        break;
      }

      case "daily_report": {
        // Fire once per day at ~7am COT (12:00 UTC)
        const hour = new Date().getUTCHours();
        if (hour !== 12) return; // Only at noon UTC = 7am COT

        const rows = await db.execute(sql`
          SELECT
            (SELECT count(*) FROM devices WHERE status = 'offline') as cameras_offline,
            (SELECT count(*) FROM database_records WHERE category ='service_tickets' AND data->>'status' = 'Pendiente') as tickets_pending
        `);
        const data = (rows[0] as any) || {};
        shouldFire = true;
        templateVars = {
          date: new Date().toLocaleDateString("es-CO"),
          cameras_offline: String(data.cameras_offline || 0),
          tickets_pending: String(data.tickets_pending || 0),
        };
        break;
      }

      case "monthly_siren_reminder": {
        // Fire on 1st Monday of each month
        const now = new Date();
        const day = now.getDate();
        const dow = now.getDay(); // 0=Sun, 1=Mon
        if (day <= 7 && dow === 1) {
          shouldFire = true;
        }
        break;
      }

      case "camera_offline": {
        const rows = await db.execute(sql`
          SELECT count(*) as cnt FROM devices
          WHERE status = 'offline'
            AND updated_at > NOW() - INTERVAL '30 minutes'
        `);
        const count = Number((rows[0] as any)?.cnt || 0);
        if (count > 0) {
          shouldFire = true;
          templateVars = { count: String(count) };
        }
        break;
      }

      default:
        // Unknown event type — skip
        return;
    }

    if (!shouldFire) return;

    // Replace template variables
    let message = rule.messageTemplate;
    for (const [key, value] of Object.entries(templateVars)) {
      message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }

    // Send via configured channel
    try {
      if (rule.channel === "whatsapp" || rule.channel === "all") {
        await twilioService.sendWhatsApp(recipientPhone, message);
      }
      if (rule.channel === "sms" || rule.channel === "all") {
        await twilioService.sendSMS(recipientPhone, message);
      }
      if (rule.channel === "call") {
        await twilioService.makeCall(recipientPhone, { message });
      }

      // Update lastFiredAt
      await db
        .update(twilioNotificationRules)
        .set({ lastFiredAt: new Date() })
        .where(eq(twilioNotificationRules.id, rule.id));

      logger.info(
        { ruleId: rule.id, event: rule.eventType, to: recipientPhone },
        "Notification rule fired",
      );
    } catch (err: any) {
      logger.error(
        { ruleId: rule.id, error: err.message },
        "Failed to send notification",
      );
    }
  }
}

export const twilioNotificationWorker = new TwilioNotificationWorker();
