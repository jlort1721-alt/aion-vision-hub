import { eq, and, sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';
import type { Database } from '../db/client.js';
import {
  events,
  incidents,
  alertRules,
  alertInstances,
  escalationPolicies,
  notificationLog,
  emergencyProtocols,
  emergencyActivations,
  emergencyContacts,
} from '../db/schema/index.js';
import { emailService } from '../modules/email/service.js';
import { pushService } from '../modules/push/service.js';
import { whatsappService } from '../modules/whatsapp/service.js';
import { evaluateAutomationRules } from './automation-engine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceStateChangeParams {
  deviceId: string;
  deviceName: string;
  siteName: string;
  siteId: string;
  tenantId: string;
  previousStatus: string | null;
  newStatus: string;
  wanIp: string;
  port: number;
}

interface AlertAction {
  type: string;
  recipients?: string[];
  phones?: string[];
  [key: string]: unknown;
}

interface AlertConditions {
  eventType?: string;
  severity?: string;
  siteId?: string;
  deviceId?: string;
  [key: string]: unknown;
}

const logger = createLogger({ name: 'notification-dispatcher' });

// System user ID used when the dispatcher creates incidents automatically
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function dispatchDeviceStateChange(
  db: Database,
  params: DeviceStateChangeParams,
): Promise<void> {
  const {
    deviceId,
    deviceName,
    siteName,
    siteId,
    tenantId,
    previousStatus,
    newStatus,
    wanIp,
    port,
  } = params;

  const eventType = newStatus === 'offline' ? 'device_offline' : 'device_online';
  const severity = newStatus === 'offline' ? 'high' : 'info';
  const title = `Dispositivo ${deviceName} cambió a ${newStatus}`;

  // 1. Insert event
  let eventId: string | undefined;
  try {
    const [inserted] = await db
      .insert(events)
      .values({
        tenantId,
        siteId,
        deviceId,
        eventType,
        severity,
        status: 'new',
        title,
        metadata: { previousStatus, newStatus, wanIp, port },
      })
      .returning({ id: events.id });

    eventId = inserted?.id;
    logger.info({ eventId, eventType }, 'Event created');
  } catch (err) {
    logger.error({ err }, 'Failed to insert event');
    // Continue anyway — we still want to try alert rules
  }

  // 2. Query active alert rules for this tenant
  let matchingRules: Array<{
    id: string;
    name: string;
    conditions: unknown;
    actions: unknown;
    severity: string;
    cooldownMinutes: number;
    lastTriggeredAt: Date | null;
    triggerCount: number;
  }>;

  try {
    matchingRules = await db
      .select({
        id: alertRules.id,
        name: alertRules.name,
        conditions: alertRules.conditions,
        actions: alertRules.actions,
        severity: alertRules.severity,
        cooldownMinutes: alertRules.cooldownMinutes,
        lastTriggeredAt: alertRules.lastTriggeredAt,
        triggerCount: alertRules.triggerCount,
      })
      .from(alertRules)
      .where(
        and(
          eq(alertRules.tenantId, tenantId),
          eq(alertRules.isActive, true),
        ),
      );
  } catch (err) {
    logger.error({ err }, 'Failed to query alert rules');
    return;
  }

  // 3. Filter rules whose conditions match this event type
  const now = new Date();

  for (const rule of matchingRules) {
    try {
      const conditions = rule.conditions as AlertConditions;

      // Check eventType condition
      if (conditions.eventType && conditions.eventType !== eventType) {
        continue;
      }

      // Check siteId condition
      if (conditions.siteId && conditions.siteId !== siteId) {
        continue;
      }

      // Check deviceId condition
      if (conditions.deviceId && conditions.deviceId !== deviceId) {
        continue;
      }

      // Check cooldown
      if (rule.lastTriggeredAt) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        const elapsed = now.getTime() - new Date(rule.lastTriggeredAt).getTime();
        if (elapsed < cooldownMs) {
          logger.info({ ruleName: rule.name, cooldownRemainingSec: Math.round((cooldownMs - elapsed) / 1000) }, 'Rule skipped (cooldown)');
          continue;
        }
      }

      logger.info({ ruleName: rule.name }, 'Rule matched — dispatching actions');

      // 4. Create alert instance
      let alertInstanceId: string | undefined;
      try {
        const [instance] = await db
          .insert(alertInstances)
          .values({
            tenantId,
            ruleId: rule.id,
            eventId: eventId ?? null,
            status: 'firing',
            severity: rule.severity,
            title,
            message: `${deviceName} en ${siteName} cambió de ${previousStatus ?? 'unknown'} a ${newStatus} (${wanIp}:${port})`,
            metadata: { deviceId, siteId, eventType, previousStatus, newStatus, wanIp, port },
          })
          .returning({ id: alertInstances.id });

        alertInstanceId = instance?.id;
      } catch (err) {
        logger.error({ err }, 'Failed to create alert instance');
      }

      // 5. Dispatch each action
      const actions = (
        Array.isArray(rule.actions) ? rule.actions : [rule.actions]
      ) as AlertAction[];
      const actionsLog: Array<{ action: string; target: string; sentAt: string; status: string; error?: string }> = [];

      for (const action of actions) {
        await dispatchAction(db, {
          action,
          tenantId,
          title,
          deviceId,
          deviceName,
          siteName,
          eventType,
          severity,
          siteId,
          eventId,
          alertInstanceId,
          previousStatus,
          newStatus,
          wanIp,
          port,
          actionsLog,
        });
      }

      // 6. Update rule trigger count and last_triggered_at
      try {
        await db
          .update(alertRules)
          .set({
            triggerCount: sql`${alertRules.triggerCount} + 1`,
            lastTriggeredAt: now,
            updatedAt: now,
          })
          .where(eq(alertRules.id, rule.id));
      } catch (err) {
        logger.error({ err, ruleName: rule.name }, 'Failed to update rule');
      }

      // 7. Update alert instance with actions log
      if (alertInstanceId && actionsLog.length > 0) {
        try {
          await db
            .update(alertInstances)
            .set({ actionsLog, updatedAt: now })
            .where(eq(alertInstances.id, alertInstanceId));
        } catch (err) {
          logger.error({ err }, 'Failed to update alert instance actions log');
        }
      }
    } catch (err) {
      logger.error({ err, ruleName: rule.name }, 'Error processing rule');
      // Continue to next rule
    }
  }

  // 8. Evaluate automation rules (phase3 automation engine)
  try {
    await evaluateAutomationRules(db, {
      id: crypto.randomUUID(),
      tenantId,
      siteId,
      deviceId,
      eventType,
      severity,
      metadata: { deviceName, siteName, previousStatus, newStatus, wanIp, port },
    });
  } catch (err) {
    logger.error({ err }, 'Automation engine evaluation failed');
  }
}

// ---------------------------------------------------------------------------
// Action dispatcher — each action type in isolation
// ---------------------------------------------------------------------------

interface DispatchActionContext {
  action: AlertAction;
  tenantId: string;
  title: string;
  deviceId: string;
  deviceName: string;
  siteName: string;
  eventType: string;
  severity: string;
  siteId: string;
  eventId: string | undefined;
  alertInstanceId: string | undefined;
  previousStatus: string | null;
  newStatus: string;
  wanIp: string;
  port: number;
  actionsLog: Array<{ action: string; target: string; sentAt: string; status: string; error?: string }>;
}

async function dispatchAction(db: Database, ctx: DispatchActionContext): Promise<void> {
  const { action, tenantId, title, deviceName, siteName, eventType, severity, actionsLog } = ctx;

  switch (action.type) {
    // ── Email ───────────────────────────────────────────────
    case 'email': {
      const recipients = action.recipients ?? [];
      if (recipients.length === 0) {
        logger.warn('Email action has no recipients, skipping');
        break;
      }

      try {
        const result = await emailService.sendEventAlert({
          to: recipients,
          severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
          eventType,
          title,
          description: `${deviceName} en ${siteName} cambió a ${ctx.newStatus} (antes: ${ctx.previousStatus ?? 'unknown'}). IP: ${ctx.wanIp}:${ctx.port}`,
          deviceName,
          siteName,
        });

        actionsLog.push({
          action: 'email',
          target: recipients.join(', '),
          sentAt: new Date().toISOString(),
          status: result.success ? 'sent' : 'failed',
          ...(result.error ? { error: result.error } : {}),
        });

        await logNotification(db, {
          tenantId,
          alertInstanceId: ctx.alertInstanceId,
          type: 'email',
          recipient: recipients.join(', '),
          subject: title,
          message: `Device ${deviceName} state change: ${ctx.previousStatus} -> ${ctx.newStatus}`,
          status: result.success ? 'sent' : 'failed',
          error: result.error,
        });
      } catch (err) {
        logger.error({ err }, 'Email dispatch failed');
        actionsLog.push({
          action: 'email',
          target: recipients.join(', '),
          sentAt: new Date().toISOString(),
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      break;
    }

    // ── Push ────────────────────────────────────────────────
    case 'push': {
      try {
        const result = await pushService.sendToTenant(tenantId, {
          title,
          body: `${deviceName} en ${siteName} cambió a ${ctx.newStatus}`,
          url: `/devices?highlight=${ctx.deviceId}`,
        });

        actionsLog.push({
          action: 'push',
          target: `tenant:${tenantId}`,
          sentAt: new Date().toISOString(),
          status: result.sent > 0 ? 'sent' : 'no_subscribers',
        });

        await logNotification(db, {
          tenantId,
          alertInstanceId: ctx.alertInstanceId,
          type: 'push',
          recipient: `tenant:${tenantId}`,
          subject: title,
          message: `Sent to ${result.sent} subscribers, ${result.failed} failed`,
          status: result.sent > 0 ? 'sent' : 'failed',
        });
      } catch (err) {
        logger.error({ err }, 'Push dispatch failed');
        actionsLog.push({
          action: 'push',
          target: `tenant:${tenantId}`,
          sentAt: new Date().toISOString(),
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      break;
    }

    // ── WhatsApp ────────────────────────────────────────────
    case 'whatsapp': {
      const phones = action.phones ?? [];
      if (phones.length === 0) {
        logger.warn('WhatsApp action has no phone numbers, skipping');
        break;
      }

      for (const phone of phones) {
        try {
          await whatsappService.sendMessage(tenantId, {
            to: phone,
            type: 'text',
            body: `[AION] ${title}\n${deviceName} en ${siteName}\nEstado: ${ctx.previousStatus ?? 'unknown'} → ${ctx.newStatus}\nIP: ${ctx.wanIp}:${ctx.port}`,
          });

          actionsLog.push({
            action: 'whatsapp',
            target: phone,
            sentAt: new Date().toISOString(),
            status: 'sent',
          });

          await logNotification(db, {
            tenantId,
            alertInstanceId: ctx.alertInstanceId,
            type: 'whatsapp',
            recipient: phone,
            subject: title,
            message: `WhatsApp sent to ${phone}`,
            status: 'sent',
          });
        } catch (err) {
          logger.error({ err, phone }, 'WhatsApp dispatch failed');
          actionsLog.push({
            action: 'whatsapp',
            target: phone,
            sentAt: new Date().toISOString(),
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
      break;
    }

    // ── Create Incident ─────────────────────────────────────
    case 'create_incident': {
      try {
        const [incident] = await db
          .insert(incidents)
          .values({
            tenantId,
            siteId: ctx.siteId,
            title: `[Auto] ${title}`,
            description: `Incidente generado automáticamente.\n${deviceName} en ${siteName} cambió de ${ctx.previousStatus ?? 'unknown'} a ${ctx.newStatus}.\nIP: ${ctx.wanIp}:${ctx.port}`,
            status: 'open',
            priority: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
            createdBy: SYSTEM_USER_ID,
            eventIds: ctx.eventId ? [ctx.eventId] : [],
          })
          .returning({ id: incidents.id });

        logger.info({ incidentId: incident?.id }, 'Incident created');
        actionsLog.push({
          action: 'create_incident',
          target: incident?.id ?? 'unknown',
          sentAt: new Date().toISOString(),
          status: 'created',
        });
      } catch (err) {
        logger.error({ err }, 'Incident creation failed');
        actionsLog.push({
          action: 'create_incident',
          target: 'n/a',
          sentAt: new Date().toISOString(),
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      break;
    }

    // ── Escalation ────────────────────────────────────────────
    case 'escalation': {
      const policyId = action.escalationPolicyId as string | undefined;
      if (!policyId) {
        logger.warn('Escalation action missing escalationPolicyId, skipping');
        actionsLog.push({
          action: 'escalation',
          target: 'none',
          sentAt: new Date().toISOString(),
          status: 'skipped',
          error: 'No escalationPolicyId configured',
        });
        break;
      }

      try {
        // Fetch the active escalation policy for this tenant
        const [policy] = await db
          .select()
          .from(escalationPolicies)
          .where(
            and(
              eq(escalationPolicies.id, policyId),
              eq(escalationPolicies.tenantId, tenantId),
              eq(escalationPolicies.isActive, true),
            ),
          )
          .limit(1);

        if (!policy) {
          logger.warn({ policyId }, 'Escalation policy not found or inactive');
          actionsLog.push({
            action: 'escalation',
            target: policyId,
            sentAt: new Date().toISOString(),
            status: 'failed',
            error: 'Escalation policy not found or inactive',
          });
          break;
        }

        // Get the current escalation level from the alert instance
        const currentLevel = ctx.alertInstanceId
          ? await (async () => {
              const [instance] = await db
                .select({ currentLevel: alertInstances.currentLevel })
                .from(alertInstances)
                .where(eq(alertInstances.id, ctx.alertInstanceId!))
                .limit(1);
              return instance?.currentLevel ?? 1;
            })()
          : 1;

        const levels = (policy.levels ?? []) as Array<{
          level: number;
          notifyRoles?: string[];
          notifyUsers?: string[];
          emails?: string[];
          timeoutMinutes?: number;
        }>;

        // Find the level definition matching the current escalation level
        const levelDef = levels.find((l) => l.level === currentLevel);

        if (!levelDef) {
          logger.info({ level: currentLevel, policyName: policy.name }, 'Maximum escalation level reached');
          actionsLog.push({
            action: 'escalation',
            target: policyId,
            sentAt: new Date().toISOString(),
            status: 'max_level_reached',
          });
          break;
        }

        logger.info({ level: currentLevel, policyName: policy.name }, 'Escalating via policy');

        // Send email notifications to escalation contacts
        const escalationEmails = levelDef.emails ?? [];
        if (escalationEmails.length > 0) {
          try {
            const emailResult = await emailService.sendEventAlert({
              to: escalationEmails,
              severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
              eventType,
              title: `[Escalation L${currentLevel}] ${title}`,
              description: `Escalation level ${currentLevel} — ${ctx.deviceName} en ${ctx.siteName} cambió a ${ctx.newStatus} (antes: ${ctx.previousStatus ?? 'unknown'}). IP: ${ctx.wanIp}:${ctx.port}`,
              deviceName: ctx.deviceName,
              siteName: ctx.siteName,
            });

            await logNotification(db, {
              tenantId,
              alertInstanceId: ctx.alertInstanceId,
              type: 'escalation_email',
              recipient: escalationEmails.join(', '),
              subject: `[Escalation L${currentLevel}] ${title}`,
              message: `Escalation level ${currentLevel} via policy "${policy.name}"`,
              status: emailResult.success ? 'sent' : 'failed',
              error: emailResult.error,
            });
          } catch (err) {
            logger.error({ err }, 'Escalation email failed');
          }
        }

        // Send push notification for escalation
        try {
          const pushResult = await pushService.sendToTenant(tenantId, {
            title: `[Escalation L${currentLevel}] ${title}`,
            body: `${ctx.deviceName} en ${ctx.siteName} — escalado a nivel ${currentLevel}`,
            url: `/devices?highlight=${ctx.deviceId}`,
          });

          await logNotification(db, {
            tenantId,
            alertInstanceId: ctx.alertInstanceId,
            type: 'escalation_push',
            recipient: `tenant:${tenantId}`,
            subject: `[Escalation L${currentLevel}] ${title}`,
            message: `Push sent to ${pushResult.sent} subscribers`,
            status: pushResult.sent > 0 ? 'sent' : 'failed',
          });
        } catch (err) {
          logger.error({ err }, 'Escalation push failed');
        }

        // Advance the alert instance to the next escalation level
        if (ctx.alertInstanceId) {
          try {
            const nextLevel = currentLevel + 1;
            const nextLevelDef = levels.find((l) => l.level === nextLevel);
            const nextEscalationAt = nextLevelDef?.timeoutMinutes
              ? new Date(Date.now() + nextLevelDef.timeoutMinutes * 60 * 1000)
              : null;

            await db
              .update(alertInstances)
              .set({
                currentLevel: nextLevel,
                escalationPolicyId: policyId,
                nextEscalationAt,
                updatedAt: new Date(),
              })
              .where(eq(alertInstances.id, ctx.alertInstanceId));
          } catch (err) {
            logger.error({ err }, 'Failed to update alert instance escalation level');
          }
        }

        actionsLog.push({
          action: 'escalation',
          target: policyId,
          sentAt: new Date().toISOString(),
          status: 'escalated',
        });
      } catch (err) {
        logger.error({ err }, 'Escalation dispatch failed');
        actionsLog.push({
          action: 'escalation',
          target: policyId,
          sentAt: new Date().toISOString(),
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      break;
    }

    // ── Activate Protocol ──────────────────────────────────────
    case 'activate_protocol': {
      const protocolType = (action.protocolType as string) ?? null;

      try {
        // Find the matching emergency protocol for this tenant
        const protocolConditions = [
          eq(emergencyProtocols.tenantId, tenantId),
          eq(emergencyProtocols.isActive, true),
        ];
        if (protocolType) {
          protocolConditions.push(eq(emergencyProtocols.type, protocolType));
        }

        const [protocol] = await db
          .select()
          .from(emergencyProtocols)
          .where(and(...protocolConditions))
          .limit(1);

        if (!protocol) {
          logger.warn({ protocolType: protocolType ?? 'any', tenantId }, 'No active emergency protocol found');
          actionsLog.push({
            action: 'activate_protocol',
            target: protocolType ?? 'unknown',
            sentAt: new Date().toISOString(),
            status: 'failed',
            error: 'No matching active emergency protocol found',
          });
          break;
        }

        // Create the emergency activation record
        const now = new Date();
        const initialTimeline = [
          {
            action: 'activated',
            by: SYSTEM_USER_ID,
            at: now.toISOString(),
            note: `Auto-activated by alert rule — ${ctx.deviceName} en ${ctx.siteName} changed to ${ctx.newStatus}`,
          },
        ];

        const [activation] = await db
          .insert(emergencyActivations)
          .values({
            tenantId,
            protocolId: protocol.id,
            siteId: ctx.siteId,
            activatedBy: SYSTEM_USER_ID,
            status: 'active',
            timeline: initialTimeline,
          })
          .returning({ id: emergencyActivations.id });

        logger.info({ protocolName: protocol.name, activationId: activation?.id }, 'Emergency protocol activated');

        await logNotification(db, {
          tenantId,
          alertInstanceId: ctx.alertInstanceId,
          type: 'protocol_activation',
          recipient: `protocol:${protocol.id}`,
          subject: `Emergency protocol "${protocol.name}" activated`,
          message: `Auto-activated for ${ctx.deviceName} en ${ctx.siteName} — ${ctx.previousStatus ?? 'unknown'} → ${ctx.newStatus}`,
          status: 'sent',
        });

        // Notify emergency contacts for the site (if any)
        const siteConditions = [
          eq(emergencyContacts.tenantId, tenantId),
          eq(emergencyContacts.isActive, true),
        ];
        if (ctx.siteId) {
          siteConditions.push(eq(emergencyContacts.siteId, ctx.siteId));
        }

        const contacts = await db
          .select()
          .from(emergencyContacts)
          .where(and(...siteConditions));

        for (const contact of contacts) {
          // Send email if the contact has an email address
          if (contact.email) {
            try {
              const emailResult = await emailService.sendEventAlert({
                to: [contact.email],
                severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
                eventType: 'emergency_protocol',
                title: `[EMERGENCY] ${protocol.name} — ${ctx.siteName}`,
                description: `Protocolo de emergencia "${protocol.name}" activado automáticamente.\n${ctx.deviceName} en ${ctx.siteName} cambió de ${ctx.previousStatus ?? 'unknown'} a ${ctx.newStatus}.\nContacto: ${contact.name} (${contact.role})`,
                deviceName: ctx.deviceName,
                siteName: ctx.siteName,
              });

              await logNotification(db, {
                tenantId,
                alertInstanceId: ctx.alertInstanceId,
                type: 'emergency_email',
                recipient: contact.email,
                subject: `[EMERGENCY] ${protocol.name}`,
                message: `Emergency contact: ${contact.name} (${contact.role})`,
                status: emailResult.success ? 'sent' : 'failed',
                error: emailResult.error,
              });
            } catch (err) {
              logger.error({ err, email: contact.email }, 'Emergency email failed');
            }
          }

          // Send push notification
          try {
            await pushService.sendToTenant(tenantId, {
              title: `[EMERGENCY] ${protocol.name}`,
              body: `Protocolo activado — ${ctx.deviceName} en ${ctx.siteName}. Contacto: ${contact.name}`,
              url: `/emergency?activation=${activation?.id}`,
            });
          } catch (err) {
            logger.error({ err, contactName: contact.name }, 'Emergency push failed');
          }
        }

        actionsLog.push({
          action: 'activate_protocol',
          target: `${protocol.name} (${activation?.id ?? 'unknown'})`,
          sentAt: new Date().toISOString(),
          status: 'activated',
        });
      } catch (err) {
        logger.error({ err }, 'Protocol activation failed');
        actionsLog.push({
          action: 'activate_protocol',
          target: protocolType ?? 'unknown',
          sentAt: new Date().toISOString(),
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      break;
    }

    default:
      logger.warn({ actionType: action.type }, 'Unknown action type');
  }
}

// ---------------------------------------------------------------------------
// Notification log helper
// ---------------------------------------------------------------------------

async function logNotification(
  db: Database,
  entry: {
    tenantId: string;
    alertInstanceId: string | undefined;
    type: string;
    recipient: string;
    subject: string;
    message: string;
    status: string;
    error?: string;
  },
): Promise<void> {
  try {
    await db.insert(notificationLog).values({
      tenantId: entry.tenantId,
      alertInstanceId: entry.alertInstanceId ?? null,
      type: entry.type,
      recipient: entry.recipient,
      subject: entry.subject,
      message: entry.message,
      status: entry.status,
      error: entry.error ?? null,
      sentAt: entry.status === 'sent' ? new Date() : null,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to write notification log');
  }
}
