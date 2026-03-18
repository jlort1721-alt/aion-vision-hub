import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import {
  automationRules,
  automationExecutions,
  incidents,
  events,
  notificationLog,
  emergencyProtocols,
  emergencyActivations,
  emergencyContacts,
} from '../db/schema/index.js';
import { emailService } from '../modules/email/service.js';
import { pushService } from '../modules/push/service.js';
import { whatsappService } from '../modules/whatsapp/service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutomationEvent {
  tenantId: string;
  siteId: string;
  deviceId: string;
  eventType: string;
  severity: string;
  metadata: Record<string, unknown>;
}

interface RuleTrigger {
  type: 'event' | 'schedule' | 'device_status' | 'threshold';
  eventType?: string;
  status?: string;
  threshold?: number;
  field?: string;
  schedule?: { hour?: number; dayOfWeek?: number };
  [key: string]: unknown;
}

interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';
  value: unknown;
}

interface RuleAction {
  type: 'send_alert' | 'create_incident' | 'send_whatsapp' | 'webhook' | 'toggle_device' | 'activate_protocol';
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ActionResult {
  action: string;
  status: 'success' | 'failed';
  detail: string;
}

// System user for auto-created incidents
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Trigger matching
// ---------------------------------------------------------------------------

function triggerMatchesEvent(trigger: RuleTrigger, event: AutomationEvent): boolean {
  switch (trigger.type) {
    case 'event':
      // Match by eventType
      return !trigger.eventType || trigger.eventType === event.eventType;

    case 'device_status':
      // Match device status from metadata (e.g. newStatus === trigger.status)
      if (trigger.status && event.metadata.newStatus !== trigger.status) {
        return false;
      }
      return true;

    case 'threshold':
      // Check if a numeric field in metadata exceeds the threshold
      if (trigger.field && trigger.threshold !== undefined) {
        const val = Number(event.metadata[trigger.field]);
        return !isNaN(val) && val >= trigger.threshold;
      }
      return false;

    case 'schedule':
      // Schedule rules are not evaluated via events; handled by processScheduledRules
      return false;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Condition checking
// ---------------------------------------------------------------------------

function conditionsMatch(conditions: RuleCondition[], event: AutomationEvent): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;

  for (const cond of conditions) {
    const actual = resolveField(cond.field, event);
    if (!evaluateCondition(actual, cond.operator, cond.value)) {
      return false;
    }
  }
  return true;
}

function resolveField(field: string, event: AutomationEvent): unknown {
  switch (field) {
    case 'severity':
      return event.severity;
    case 'siteId':
      return event.siteId;
    case 'deviceId':
      return event.deviceId;
    case 'eventType':
      return event.eventType;
    case 'timeHour':
      return new Date().getHours();
    case 'timeDayOfWeek':
      return new Date().getDay();
    default:
      // Check metadata
      return event.metadata[field];
  }
}

function evaluateCondition(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual);
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Cooldown check
// ---------------------------------------------------------------------------

function isCooldownActive(lastTriggeredAt: Date | null, cooldownMinutes: number): boolean {
  if (!lastTriggeredAt) return false;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const elapsed = Date.now() - new Date(lastTriggeredAt).getTime();
  return elapsed < cooldownMs;
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

async function executeAction(
  db: Database,
  action: RuleAction,
  event: AutomationEvent,
): Promise<ActionResult> {
  switch (action.type) {
    case 'send_alert': {
      const target = (action.config?.channel as string) ?? 'default';
      const recipients = (action.config?.recipients as string[]) ?? [];
      const subject = (action.config?.subject as string) ?? `[AION Alert] ${event.eventType} — ${event.severity}`;
      const body = (action.config?.body as string) ??
        `Automation alert triggered.\nEvent: ${event.eventType}\nSeverity: ${event.severity}\nSite: ${event.siteId}\nDevice: ${event.deviceId}\nMetadata: ${JSON.stringify(event.metadata)}`;

      console.log(
        `[automation-engine] send_alert: tenant=${event.tenantId}, eventType=${event.eventType}, severity=${event.severity}, channel=${target}`,
      );

      const details: string[] = [];

      // Send email alert if recipients are configured
      if (recipients.length > 0) {
        try {
          const emailResult = await emailService.sendEventAlert({
            to: recipients,
            severity: event.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
            eventType: event.eventType,
            title: subject,
            description: body,
            deviceName: (event.metadata.deviceName as string) ?? event.deviceId,
            siteName: (event.metadata.siteName as string) ?? event.siteId,
          });

          if (emailResult.success) {
            details.push(`Email sent to ${recipients.length} recipient(s)`);
            console.log(`[automation-engine] send_alert email: sent to ${recipients.join(', ')}`);
          } else {
            details.push(`Email failed: ${emailResult.error ?? 'unknown error'}`);
            console.error(`[automation-engine] send_alert email failed:`, emailResult.error);
          }

          // Log the notification
          try {
            await db.insert(notificationLog).values({
              tenantId: event.tenantId,
              alertInstanceId: null,
              type: 'automation_email',
              recipient: recipients.join(', '),
              subject,
              message: body,
              status: emailResult.success ? 'sent' : 'failed',
              error: emailResult.error ?? null,
              sentAt: emailResult.success ? new Date() : null,
            });
          } catch (logErr) {
            console.error('[automation-engine] Failed to write notification log:', logErr);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          details.push(`Email error: ${msg}`);
          console.error('[automation-engine] send_alert email error:', msg);
        }
      } else {
        details.push('No email recipients configured');
      }

      // Send push notification to the tenant
      try {
        const pushResult = await pushService.sendToTenant(event.tenantId, {
          title: subject,
          body: `${event.eventType} (${event.severity}) — ${(event.metadata.deviceName as string) ?? event.deviceId}`,
          url: event.deviceId ? `/devices?highlight=${event.deviceId}` : undefined,
        });

        if (pushResult.sent > 0) {
          details.push(`Push sent to ${pushResult.sent} subscriber(s)`);
          console.log(`[automation-engine] send_alert push: sent to ${pushResult.sent} subscribers`);
        } else {
          details.push('Push: no subscribers');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        details.push(`Push error: ${msg}`);
        console.error('[automation-engine] send_alert push error:', msg);
      }

      const allOk = details.every((d) => !d.toLowerCase().includes('error') && !d.toLowerCase().includes('failed'));
      return {
        action: 'send_alert',
        status: allOk ? 'success' : 'failed',
        detail: details.join('; '),
      };
    }

    case 'create_incident': {
      try {
        const title = (action.config?.title as string) ?? `[Auto] ${event.eventType} on device ${event.deviceId}`;
        const priority = (action.config?.priority as string) ?? mapSeverityToPriority(event.severity);

        const [incident] = await db
          .insert(incidents)
          .values({
            tenantId: event.tenantId,
            siteId: event.siteId,
            title,
            description: `Incident auto-created by automation engine.\nEvent: ${event.eventType}\nSeverity: ${event.severity}\nDevice: ${event.deviceId}\nMetadata: ${JSON.stringify(event.metadata)}`,
            status: 'open',
            priority,
            createdBy: SYSTEM_USER_ID,
          })
          .returning({ id: incidents.id });

        console.log(`[automation-engine] create_incident: ${incident?.id}`);
        return { action: 'create_incident', status: 'success', detail: `Incident created: ${incident?.id}` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[automation-engine] create_incident failed:', msg);
        return { action: 'create_incident', status: 'failed', detail: msg };
      }
    }

    case 'send_whatsapp': {
      const phones = (action.config?.phones as string[]) ?? [];
      const message = (action.config?.message as string) ??
        `[AION] Automation alert\nEvent: ${event.eventType}\nSeverity: ${event.severity}\nDevice: ${(event.metadata.deviceName as string) ?? event.deviceId}\nSite: ${(event.metadata.siteName as string) ?? event.siteId}`;

      console.log(
        `[automation-engine] send_whatsapp: tenant=${event.tenantId}, phones=${phones.join(',')}`,
      );

      if (phones.length === 0) {
        return {
          action: 'send_whatsapp',
          status: 'failed',
          detail: 'No phone numbers configured',
        };
      }

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const phone of phones) {
        try {
          const result = await whatsappService.sendMessage(
            event.tenantId,
            { to: phone, type: 'text', body: message },
            'system',
            'Automation Engine',
          );

          if (result.success) {
            sent++;
            console.log(`[automation-engine] send_whatsapp: sent to ${phone}`);
          } else {
            failed++;
            errors.push(`${phone}: ${result.error ?? 'send failed'}`);
            console.error(`[automation-engine] send_whatsapp to ${phone} failed:`, result.error);
          }
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${phone}: ${msg}`);
          console.error(`[automation-engine] send_whatsapp to ${phone} error:`, msg);
        }
      }

      const detail = `WhatsApp: ${sent} sent, ${failed} failed${errors.length > 0 ? ` (${errors.join('; ')})` : ''}`;
      return {
        action: 'send_whatsapp',
        status: failed === phones.length ? 'failed' : 'success',
        detail,
      };
    }

    case 'webhook': {
      const url = action.config?.url as string;
      if (!url) {
        return { action: 'webhook', status: 'failed', detail: 'No webhook URL configured' };
      }
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: event.eventType,
            severity: event.severity,
            tenantId: event.tenantId,
            siteId: event.siteId,
            deviceId: event.deviceId,
            metadata: event.metadata,
            triggeredAt: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const statusCode = response.status;
        console.log(`[automation-engine] webhook: POST ${url} -> ${statusCode}`);
        return {
          action: 'webhook',
          status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failed',
          detail: `HTTP ${statusCode} from ${url}`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[automation-engine] webhook to ${url} failed:`, msg);
        return { action: 'webhook', status: 'failed', detail: msg };
      }
    }

    case 'toggle_device': {
      const targetDeviceId = (action.config?.deviceId as string) ?? event.deviceId;
      const targetState = (action.config?.state as string) ?? 'toggle';

      console.log(
        `[automation-engine] toggle_device: device=${targetDeviceId}, state=${targetState}`,
      );

      // Device control requires the edge gateway (ONVIF/IoT protocol); there is no
      // direct HTTP toggle in the backend. We record an event so operators and
      // dashboards can track the automation request, and notify via push.
      try {
        const [evt] = await db
          .insert(events)
          .values({
            tenantId: event.tenantId,
            siteId: event.siteId,
            deviceId: targetDeviceId,
            eventType: 'automation_toggle_device',
            severity: 'info',
            status: 'new',
            title: `Automation requested device ${targetState}: ${targetDeviceId}`,
            metadata: {
              requestedState: targetState,
              triggerEvent: event.eventType,
              triggerSeverity: event.severity,
              sourceDeviceId: event.deviceId,
              automationAction: 'toggle_device',
            },
          })
          .returning({ id: events.id });

        console.log(`[automation-engine] toggle_device event created: ${evt?.id}`);

        // Send a push notification so operators can action the toggle manually
        try {
          await pushService.sendToTenant(event.tenantId, {
            title: `Device Toggle Requested`,
            body: `Automation requested ${targetState} for device ${targetDeviceId}. Manual action may be required.`,
            url: `/devices?highlight=${targetDeviceId}`,
          });
        } catch (pushErr) {
          console.error('[automation-engine] toggle_device push notification failed:', pushErr);
        }

        return {
          action: 'toggle_device',
          status: 'success',
          detail: `Toggle event created (${evt?.id}). Device control requires edge gateway — operator notified via push.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[automation-engine] toggle_device event creation failed:', msg);
        return {
          action: 'toggle_device',
          status: 'failed',
          detail: msg,
        };
      }
    }

    case 'activate_protocol': {
      const protocolId = (action.config?.protocolId as string) ?? null;
      const protocolType = (action.config?.protocolType as string) ?? null;

      console.log(
        `[automation-engine] activate_protocol: tenant=${event.tenantId}, protocolId=${protocolId ?? 'auto'}, type=${protocolType ?? 'any'}`,
      );

      try {
        // Find the matching emergency protocol for this tenant
        const protocolConditions = [
          eq(emergencyProtocols.tenantId, event.tenantId),
          eq(emergencyProtocols.isActive, true),
        ];
        if (protocolId) {
          protocolConditions.push(eq(emergencyProtocols.id, protocolId));
        }
        if (protocolType) {
          protocolConditions.push(eq(emergencyProtocols.type, protocolType));
        }

        const [protocol] = await db
          .select()
          .from(emergencyProtocols)
          .where(and(...protocolConditions))
          .limit(1);

        if (!protocol) {
          console.warn(
            `[automation-engine] No active emergency protocol found for protocolId=${protocolId ?? 'any'}, type=${protocolType ?? 'any'}, tenant=${event.tenantId}`,
          );
          return {
            action: 'activate_protocol',
            status: 'failed',
            detail: 'No matching active emergency protocol found',
          };
        }

        // Create the emergency activation record
        const now = new Date();
        const initialTimeline = [
          {
            action: 'activated',
            by: SYSTEM_USER_ID,
            at: now.toISOString(),
            note: `Auto-activated by automation engine — event: ${event.eventType}, severity: ${event.severity}, device: ${event.deviceId}`,
          },
        ];

        const [activation] = await db
          .insert(emergencyActivations)
          .values({
            tenantId: event.tenantId,
            protocolId: protocol.id,
            siteId: event.siteId || null,
            activatedBy: SYSTEM_USER_ID,
            status: 'active',
            timeline: initialTimeline,
          })
          .returning({ id: emergencyActivations.id });

        console.log(
          `[automation-engine] Emergency protocol "${protocol.name}" activated (activation=${activation?.id})`,
        );

        // Log the activation as a notification
        try {
          await db.insert(notificationLog).values({
            tenantId: event.tenantId,
            alertInstanceId: null,
            type: 'automation_protocol_activation',
            recipient: `protocol:${protocol.id}`,
            subject: `Emergency protocol "${protocol.name}" activated`,
            message: `Auto-activated by automation engine for event ${event.eventType} (${event.severity})`,
            status: 'sent',
            error: null,
            sentAt: now,
          });
        } catch (logErr) {
          console.error('[automation-engine] Failed to write notification log:', logErr);
        }

        // Notify emergency contacts for the site (if any)
        const contactConditions = [
          eq(emergencyContacts.tenantId, event.tenantId),
          eq(emergencyContacts.isActive, true),
        ];
        if (event.siteId) {
          contactConditions.push(eq(emergencyContacts.siteId, event.siteId));
        }

        let contactsNotified = 0;
        try {
          const contacts = await db
            .select()
            .from(emergencyContacts)
            .where(and(...contactConditions));

          for (const contact of contacts) {
            // Send email if the contact has an email address
            if (contact.email) {
              try {
                await emailService.sendEventAlert({
                  to: [contact.email],
                  severity: event.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
                  eventType: 'emergency_protocol',
                  title: `[EMERGENCY] ${protocol.name}`,
                  description: `Emergency protocol "${protocol.name}" auto-activated by automation engine.\nEvent: ${event.eventType}\nSeverity: ${event.severity}\nDevice: ${event.deviceId}\nContact: ${contact.name} (${contact.role})`,
                  deviceName: (event.metadata.deviceName as string) ?? event.deviceId,
                  siteName: (event.metadata.siteName as string) ?? event.siteId,
                });
                contactsNotified++;
              } catch (emailErr) {
                console.error(`[automation-engine] Emergency email to ${contact.email} failed:`, emailErr);
              }
            }

            // Send WhatsApp if the contact has a phone number
            if (contact.phone) {
              try {
                await whatsappService.sendMessage(
                  event.tenantId,
                  {
                    to: contact.phone,
                    type: 'text',
                    body: `[EMERGENCY] Protocol "${protocol.name}" activated.\nEvent: ${event.eventType} (${event.severity})\nDevice: ${(event.metadata.deviceName as string) ?? event.deviceId}`,
                  },
                  'system',
                  'Automation Engine',
                );
                contactsNotified++;
              } catch (waErr) {
                console.error(`[automation-engine] Emergency WhatsApp to ${contact.phone} failed:`, waErr);
              }
            }
          }
        } catch (contactErr) {
          console.error('[automation-engine] Failed to query/notify emergency contacts:', contactErr);
        }

        // Send push notification to the tenant
        try {
          await pushService.sendToTenant(event.tenantId, {
            title: `[EMERGENCY] ${protocol.name}`,
            body: `Protocol activated — event: ${event.eventType} (${event.severity}), device: ${(event.metadata.deviceName as string) ?? event.deviceId}`,
            url: `/emergency?activation=${activation?.id}`,
          });
        } catch (pushErr) {
          console.error('[automation-engine] Emergency push notification failed:', pushErr);
        }

        return {
          action: 'activate_protocol',
          status: 'success',
          detail: `Protocol "${protocol.name}" activated (${activation?.id}), ${contactsNotified} contact notification(s) sent`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[automation-engine] activate_protocol failed:', msg);
        return {
          action: 'activate_protocol',
          status: 'failed',
          detail: msg,
        };
      }
    }

    default:
      return { action: action.type, status: 'failed', detail: `Unknown action type: ${action.type}` };
  }
}

function mapSeverityToPriority(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
    case 'info':
    default:
      return 'low';
  }
}

// ---------------------------------------------------------------------------
// Main entry point: evaluate automation rules for an event
// ---------------------------------------------------------------------------

export async function evaluateAutomationRules(
  db: Database,
  event: AutomationEvent,
): Promise<void> {
  let rules: Array<{
    id: string;
    tenantId: string;
    name: string;
    trigger: unknown;
    conditions: unknown;
    actions: unknown;
    priority: number;
    cooldownMinutes: number;
    lastTriggeredAt: Date | null;
    triggerCount: number;
  }>;

  try {
    rules = await db
      .select({
        id: automationRules.id,
        tenantId: automationRules.tenantId,
        name: automationRules.name,
        trigger: automationRules.trigger,
        conditions: automationRules.conditions,
        actions: automationRules.actions,
        priority: automationRules.priority,
        cooldownMinutes: automationRules.cooldownMinutes,
        lastTriggeredAt: automationRules.lastTriggeredAt,
        triggerCount: automationRules.triggerCount,
      })
      .from(automationRules)
      .where(
        and(
          eq(automationRules.tenantId, event.tenantId),
          eq(automationRules.isActive, true),
        ),
      );
  } catch (err) {
    console.error('[automation-engine] Failed to query automation rules:', err);
    return;
  }

  if (rules.length === 0) return;

  console.log(`[automation-engine] Evaluating ${rules.length} active rule(s) for tenant=${event.tenantId}, event=${event.eventType}`);

  for (const rule of rules) {
    const startMs = Date.now();

    try {
      const trigger = rule.trigger as RuleTrigger;
      const conditions = rule.conditions as RuleCondition[];
      const actions = (Array.isArray(rule.actions) ? rule.actions : [rule.actions]) as RuleAction[];

      // 1. Check trigger match
      if (!triggerMatchesEvent(trigger, event)) {
        continue;
      }

      // 2. Check conditions
      if (!conditionsMatch(conditions, event)) {
        continue;
      }

      // 3. Check cooldown
      if (isCooldownActive(rule.lastTriggeredAt, rule.cooldownMinutes)) {
        console.log(`[automation-engine] Rule "${rule.name}" skipped (cooldown active)`);
        continue;
      }

      console.log(`[automation-engine] Rule "${rule.name}" matched — executing ${actions.length} action(s)`);

      // 4. Execute actions
      const results: ActionResult[] = [];
      for (const action of actions) {
        const result = await executeAction(db, action, event);
        results.push(result);
      }

      // 5. Determine overall status
      const allSuccess = results.every((r) => r.status === 'success');
      const allFailed = results.every((r) => r.status === 'failed');
      const status = allSuccess ? 'success' : allFailed ? 'failed' : 'partial';

      const executionTimeMs = Date.now() - startMs;

      // 6. Insert execution record
      try {
        await db.insert(automationExecutions).values({
          tenantId: event.tenantId,
          ruleId: rule.id,
          triggerData: event,
          results,
          status,
          executionTimeMs,
          error: allSuccess ? null : results.filter((r) => r.status === 'failed').map((r) => r.detail).join('; '),
        });
      } catch (err) {
        console.error(`[automation-engine] Failed to insert execution record for rule "${rule.name}":`, err);
      }

      // 7. Update rule trigger count and lastTriggeredAt
      try {
        await db
          .update(automationRules)
          .set({
            triggerCount: sql`${automationRules.triggerCount} + 1`,
            lastTriggeredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(automationRules.id, rule.id));
      } catch (err) {
        console.error(`[automation-engine] Failed to update rule "${rule.name}":`, err);
      }
    } catch (err) {
      // Per-rule error isolation: log and continue to next rule
      const executionTimeMs = Date.now() - startMs;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[automation-engine] Error processing rule "${rule.name}":`, errorMsg);

      try {
        await db.insert(automationExecutions).values({
          tenantId: event.tenantId,
          ruleId: rule.id,
          triggerData: event,
          results: [],
          status: 'failed',
          executionTimeMs,
          error: errorMsg,
        });
      } catch {
        // Swallow — we already logged the primary error
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Scheduled rules processor
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API — start / stop (periodic scheduled-rule evaluation)
// ---------------------------------------------------------------------------

const WORKER_TAG = '[automation-engine]';
const DEFAULT_INTERVAL_MS = 60_000; // 1 minute

let timerHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the automation engine worker.
 *
 * Checks every minute for schedule-based automation rules that are due.
 */
export function startAutomationEngine(
  db: Database,
  interval: number = DEFAULT_INTERVAL_MS,
): () => void {
  if (timerHandle) {
    console.warn(`${WORKER_TAG} Worker already running — skipping duplicate start`);
    return () => stopAutomationEngine();
  }

  console.log(`${WORKER_TAG} Starting automation engine worker (interval: ${interval / 1000}s)`);

  // Run once on start
  processScheduledRules(db).catch((err) => {
    console.error(`${WORKER_TAG} Initial tick failed:`, err);
  });

  timerHandle = setInterval(() => {
    processScheduledRules(db).catch((err) => {
      console.error(`${WORKER_TAG} Tick failed:`, err);
    });
  }, interval);

  return () => stopAutomationEngine();
}

/**
 * Stop the automation engine worker if running.
 */
export function stopAutomationEngine(): void {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
    console.log(`${WORKER_TAG} Worker stopped`);
  }
}

// ---------------------------------------------------------------------------
// Scheduled rules processor
// ---------------------------------------------------------------------------

export async function processScheduledRules(db: Database): Promise<void> {
  let rules: Array<{
    id: string;
    tenantId: string;
    name: string;
    trigger: unknown;
    conditions: unknown;
    actions: unknown;
    cooldownMinutes: number;
    lastTriggeredAt: Date | null;
    triggerCount: number;
  }>;

  try {
    rules = await db
      .select({
        id: automationRules.id,
        tenantId: automationRules.tenantId,
        name: automationRules.name,
        trigger: automationRules.trigger,
        conditions: automationRules.conditions,
        actions: automationRules.actions,
        cooldownMinutes: automationRules.cooldownMinutes,
        lastTriggeredAt: automationRules.lastTriggeredAt,
        triggerCount: automationRules.triggerCount,
      })
      .from(automationRules)
      .where(eq(automationRules.isActive, true));
  } catch (err) {
    console.error('[automation-engine] Failed to query scheduled rules:', err);
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentDayOfWeek = now.getDay();

  for (const rule of rules) {
    try {
      const trigger = rule.trigger as RuleTrigger;
      if (trigger.type !== 'schedule') continue;

      const schedule = trigger.schedule;
      if (!schedule) continue;

      // Match hour if specified
      if (schedule.hour !== undefined && schedule.hour !== currentHour) {
        continue;
      }

      // Match day of week if specified (0 = Sunday)
      if (schedule.dayOfWeek !== undefined && schedule.dayOfWeek !== currentDayOfWeek) {
        continue;
      }

      // Check cooldown to prevent duplicate execution within the same period
      if (isCooldownActive(rule.lastTriggeredAt, rule.cooldownMinutes)) {
        continue;
      }

      console.log(`[automation-engine] Scheduled rule "${rule.name}" triggered (hour=${currentHour}, day=${currentDayOfWeek})`);

      const startMs = Date.now();
      const actions = (Array.isArray(rule.actions) ? rule.actions : [rule.actions]) as RuleAction[];

      // Build a synthetic event for scheduled rules
      const syntheticEvent: AutomationEvent = {
        tenantId: rule.tenantId,
        siteId: '',
        deviceId: '',
        eventType: 'scheduled_trigger',
        severity: 'info',
        metadata: { scheduledHour: currentHour, scheduledDayOfWeek: currentDayOfWeek },
      };

      const results: ActionResult[] = [];
      for (const action of actions) {
        const result = await executeAction(db, action, syntheticEvent);
        results.push(result);
      }

      const allSuccess = results.every((r) => r.status === 'success');
      const allFailed = results.every((r) => r.status === 'failed');
      const status = allSuccess ? 'success' : allFailed ? 'failed' : 'partial';
      const executionTimeMs = Date.now() - startMs;

      try {
        await db.insert(automationExecutions).values({
          tenantId: rule.tenantId,
          ruleId: rule.id,
          triggerData: syntheticEvent,
          results,
          status,
          executionTimeMs,
          error: allSuccess ? null : results.filter((r) => r.status === 'failed').map((r) => r.detail).join('; '),
        });
      } catch (err) {
        console.error(`[automation-engine] Failed to insert execution record for scheduled rule "${rule.name}":`, err);
      }

      try {
        await db
          .update(automationRules)
          .set({
            triggerCount: sql`${automationRules.triggerCount} + 1`,
            lastTriggeredAt: now,
            updatedAt: now,
          })
          .where(eq(automationRules.id, rule.id));
      } catch (err) {
        console.error(`[automation-engine] Failed to update scheduled rule "${rule.name}":`, err);
      }
    } catch (err) {
      console.error(`[automation-engine] Error processing scheduled rule "${rule.name}":`, err);
    }
  }
}
