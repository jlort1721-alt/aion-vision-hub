import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { alertRules, alertInstances, notificationLog, notificationChannels } from '../../db/schema/index.js';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'alert-engine' });

interface EventPayload {
  id: string;
  tenantId: string;
  deviceId: string;
  siteId: string;
  type: string;
  severity: string;
  title: string;
  description?: string | null;
}

interface RuleConditions {
  eventType?: string;
  severity?: string;
  siteId?: string;
  deviceId?: string;
  timeRange?: { start: string; end: string };
  daysOfWeek?: number[];
}

interface RuleActions {
  emailRecipients?: string[];
  whatsappPhones?: string[];
  webhookUrl?: string;
  notificationChannelIds?: string[];
  escalationPolicyId?: string;
  createIncident?: boolean;
}

/**
 * Alert Engine — evaluates incoming events against active alert rules
 * and creates alert instances + sends notifications when conditions match.
 */
export class AlertEngine {
  /**
   * Process a new event against all active rules for the tenant.
   * Called from event creation route.
   */
  async processEvent(event: EventPayload): Promise<void> {
    try {
      const rules = await db
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.tenantId, event.tenantId), eq(alertRules.isActive, true)));

      for (const rule of rules) {
        try {
          if (this.matchesConditions(event, rule.conditions as RuleConditions)) {
            // Check cooldown
            if (rule.lastTriggeredAt) {
              const cooldownMs = (rule.cooldownMinutes ?? 5) * 60 * 1000;
              const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
              if (elapsed < cooldownMs) {
                logger.debug({ ruleId: rule.id, cooldownRemaining: cooldownMs - elapsed }, 'Rule in cooldown, skipping');
                continue;
              }
            }

            await this.triggerRule(rule, event);
          }
        } catch (err) {
          logger.error({ ruleId: rule.id, error: err }, 'Error processing rule for event');
        }
      }
    } catch (err) {
      logger.error({ eventId: event.id, error: err }, 'Alert engine error processing event');
    }
  }

  /**
   * Check if an event matches a rule's conditions.
   */
  private matchesConditions(event: EventPayload, conditions: RuleConditions): boolean {
    if (conditions.eventType && event.type !== conditions.eventType) return false;
    if (conditions.severity && event.severity !== conditions.severity) return false;
    if (conditions.siteId && event.siteId !== conditions.siteId) return false;
    if (conditions.deviceId && event.deviceId !== conditions.deviceId) return false;

    // Time range check (in tenant's timezone, simplified to UTC)
    if (conditions.timeRange) {
      const now = new Date();
      const [startH, startM] = conditions.timeRange.start.split(':').map(Number);
      const [endH, endM] = conditions.timeRange.end.split(':').map(Number);
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        // Same day range (e.g., 08:00 - 18:00)
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) return false;
      } else {
        // Overnight range (e.g., 22:00 - 06:00)
        if (currentMinutes < startMinutes && currentMinutes > endMinutes) return false;
      }
    }

    // Day of week check (0=Sunday, 6=Saturday)
    if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
      const today = new Date().getUTCDay();
      if (!conditions.daysOfWeek.includes(today)) return false;
    }

    return true;
  }

  /**
   * Trigger a rule: create alert instance, update rule stats, send notifications.
   */
  private async triggerRule(rule: typeof alertRules.$inferSelect, event: EventPayload): Promise<void> {
    const actions = rule.actions as RuleActions;
    const now = new Date();

    // Calculate next escalation time if escalation policy is set
    let nextEscalationAt: Date | null = null;
    if (actions.escalationPolicyId) {
      nextEscalationAt = new Date(now.getTime() + 15 * 60 * 1000); // default 15 min
    }

    // Create alert instance
    const [instance] = await db
      .insert(alertInstances)
      .values({
        tenantId: event.tenantId,
        ruleId: rule.id,
        eventId: event.id,
        status: 'firing',
        severity: rule.severity,
        title: `[${rule.severity.toUpperCase()}] ${rule.name}: ${event.title}`,
        message: event.description ?? `Event ${event.type} triggered rule "${rule.name}"`,
        currentLevel: 1,
        escalationPolicyId: actions.escalationPolicyId ?? null,
        nextEscalationAt,
        actionsLog: [],
        metadata: { eventType: event.type, deviceId: event.deviceId, siteId: event.siteId },
      })
      .returning();

    // Update rule trigger stats
    await db
      .update(alertRules)
      .set({
        lastTriggeredAt: now,
        triggerCount: (rule.triggerCount ?? 0) + 1,
        updatedAt: now,
      })
      .where(eq(alertRules.id, rule.id));

    logger.info({ ruleId: rule.id, instanceId: instance.id, severity: rule.severity }, 'Alert triggered');

    // Send notifications asynchronously (non-blocking)
    this.sendNotifications(instance, actions, event).catch((err) => {
      logger.error({ instanceId: instance.id, error: err }, 'Error sending alert notifications');
    });
  }

  /**
   * Send notifications through configured channels.
   */
  private async sendNotifications(
    instance: typeof alertInstances.$inferSelect,
    actions: RuleActions,
    event: EventPayload,
  ): Promise<void> {
    const actionsLog: Array<{ action: string; target: string; sentAt: string; status: string }> = [];

    // Email notifications
    if (actions.emailRecipients && actions.emailRecipients.length > 0) {
      for (const email of actions.emailRecipients) {
        try {
          await db.insert(notificationLog).values({
            tenantId: event.tenantId,
            alertInstanceId: instance.id,
            type: 'email',
            recipient: email,
            subject: instance.title,
            message: instance.message,
            status: 'pending',
          });
          actionsLog.push({ action: 'email', target: email, sentAt: new Date().toISOString(), status: 'queued' });
        } catch (err) {
          logger.error({ email, error: err }, 'Failed to queue email notification');
        }
      }
    }

    // Notification channel IDs
    if (actions.notificationChannelIds && actions.notificationChannelIds.length > 0) {
      for (const channelId of actions.notificationChannelIds) {
        try {
          const [channel] = await db
            .select()
            .from(notificationChannels)
            .where(and(eq(notificationChannels.id, channelId), eq(notificationChannels.tenantId, event.tenantId)))
            .limit(1);

          if (channel && channel.isActive) {
            const config = channel.config as Record<string, unknown>;
            const recipients = (config.recipients as string[]) ?? [];

            for (const recipient of recipients) {
              await db.insert(notificationLog).values({
                tenantId: event.tenantId,
                channelId: channel.id,
                alertInstanceId: instance.id,
                type: channel.type,
                recipient,
                subject: instance.title,
                message: instance.message,
                status: 'pending',
              });
            }

            actionsLog.push({
              action: channel.type,
              target: `channel:${channel.name}`,
              sentAt: new Date().toISOString(),
              status: 'queued',
            });
          }
        } catch (err) {
          logger.error({ channelId, error: err }, 'Failed to process notification channel');
        }
      }
    }

    // Webhook notifications
    if (actions.webhookUrl) {
      try {
        const response = await fetch(actions.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'alert.fired',
            alertId: instance.id,
            ruleId: instance.ruleId,
            severity: instance.severity,
            title: instance.title,
            message: instance.message,
            event: { id: event.id, type: event.type, deviceId: event.deviceId, siteId: event.siteId },
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10000),
        });

        await db.insert(notificationLog).values({
          tenantId: event.tenantId,
          alertInstanceId: instance.id,
          type: 'webhook',
          recipient: actions.webhookUrl,
          subject: instance.title,
          status: response.ok ? 'sent' : 'failed',
          error: response.ok ? null : `HTTP ${response.status}`,
          sentAt: new Date(),
        });

        actionsLog.push({
          action: 'webhook',
          target: actions.webhookUrl,
          sentAt: new Date().toISOString(),
          status: response.ok ? 'sent' : 'failed',
        });
      } catch (err) {
        logger.error({ webhookUrl: actions.webhookUrl, error: err }, 'Webhook notification failed');
      }
    }

    // Update instance with actions log
    if (actionsLog.length > 0) {
      await db
        .update(alertInstances)
        .set({ actionsLog })
        .where(eq(alertInstances.id, instance.id));
    }
  }
}

export const alertEngine = new AlertEngine();
