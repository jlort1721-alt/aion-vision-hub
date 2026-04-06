/**
 * Twilio Module Service
 *
 * Orchestrates Twilio operations with database logging.
 * Wraps the core twilio.service.ts with communication log persistence.
 */

import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';
import { db } from '../../db/client.js';
import { communicationLogs, twilioNotificationRules } from '../../db/schema/index.js';
import twilioService, { estimateCost } from '../../services/twilio.service.js';
// databaseRecords schema unused — queries use raw SQL

void createLogger({ name: 'twilio-module' });

// ══════════════════════════════════════════════════════════════
// WhatsApp
// ══════════════════════════════════════════════════════════════

export async function sendWhatsApp(
  tenantId: string,
  to: string,
  message: string,
  operatorName: string,
  options?: { mediaUrl?: string; siteId?: string; siteName?: string },
) {
  try {
    const res = await twilioService.sendWhatsApp(to, message, options?.mediaUrl);
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'whatsapp',
      direction: 'outbound',
      recipient: twilioService.normalizeColombianPhone(to),
      content: message.substring(0, 500),
      twilioSid: res.sid,
      status: 'sent',
      costEstimate: String(estimateCost('whatsapp')),
      siteId: options?.siteId,
      siteName: options?.siteName,
      operator: operatorName,
    });
    return { success: true, sid: res.sid, status: res.status };
  } catch (err: any) {
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'whatsapp',
      direction: 'outbound',
      recipient: twilioService.normalizeColombianPhone(to),
      content: message.substring(0, 500),
      status: 'failed',
      errorMessage: err.message,
      siteId: options?.siteId,
      siteName: options?.siteName,
      operator: operatorName,
    }).catch(() => {});
    throw err;
  }
}

export async function broadcastWhatsApp(
  tenantId: string,
  siteId: string,
  message: string,
  operatorName: string,
  filter?: { apartment?: string },
) {
  // Look up residents with phone numbers for this site
  const rows = await db.execute(sql`
    SELECT data->>'full_name' as full_name, data->>'phone' as phone, data->>'apartment' as apartment, data->>'site_name' as site_name
    FROM database_records
    WHERE tenant_id = ${tenantId}
      AND type = 'residents'
      AND data->>'site_id' = ${siteId}
      AND data->>'phone' IS NOT NULL
      AND data->>'phone' != ''
      ${filter?.apartment ? sql`AND data->>'apartment' = ${filter.apartment}` : sql``}
  `);

  if (!rows.length) {
    return { total: 0, sent: 0, results: [] };
  }

  const recipients = (rows as any[]).map((r) => ({
    phone: r.phone,
    message: message
      .replace('{nombre}', r.full_name || 'Residente')
      .replace('{unidad}', r.site_name || '')
      .replace('{apartamento}', r.apartment || ''),
  }));

  const results = await twilioService.broadcastWhatsApp(recipients);

  // Log each result
  for (const r of results) {
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'whatsapp',
      direction: 'outbound',
      recipient: r.phone,
      content: message.substring(0, 500),
      twilioSid: r.sid,
      status: r.success ? 'sent' : 'failed',
      errorMessage: r.error,
      costEstimate: r.success ? String(estimateCost('whatsapp')) : '0',
      siteId,
      operator: operatorName,
    }).catch(() => {});
  }

  return {
    total: recipients.length,
    sent: results.filter((r) => r.success).length,
    results,
  };
}

// ══════════════════════════════════════════════════════════════
// Voice Calls
// ══════════════════════════════════════════════════════════════

export async function makeCall(
  tenantId: string,
  to: string,
  operatorName: string,
  options?: { message?: string; siteId?: string; siteName?: string },
) {
  try {
    const res = await twilioService.makeCall(to, { message: options?.message });
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'voice_call',
      direction: 'outbound',
      recipient: twilioService.normalizeColombianPhone(to),
      content: options?.message || 'Voice call',
      twilioSid: res.sid,
      status: 'initiated',
      costEstimate: String(estimateCost('voice_call')),
      siteId: options?.siteId,
      siteName: options?.siteName,
      operator: operatorName,
    });
    return { success: true, sid: res.sid, status: res.status };
  } catch (err: any) {
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'voice_call',
      direction: 'outbound',
      recipient: twilioService.normalizeColombianPhone(to),
      content: options?.message || 'Voice call',
      status: 'failed',
      errorMessage: err.message,
      operator: operatorName,
    }).catch(() => {});
    throw err;
  }
}

export async function makeEmergencyCall(
  tenantId: string,
  to: string,
  siteName: string,
  alertType: string,
  operatorName: string,
) {
  try {
    const res = await twilioService.makeEmergencyCall(to, siteName, alertType);
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'emergency_call',
      direction: 'outbound',
      recipient: twilioService.normalizeColombianPhone(to),
      content: `Emergency: ${alertType} at ${siteName}`,
      twilioSid: res.sid,
      status: 'initiated',
      costEstimate: String(estimateCost('emergency_call')),
      siteName,
      operator: operatorName,
      metadata: { alertType, siteName },
    });
    return { success: true, sid: res.sid, status: res.status };
  } catch (err: any) {
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'emergency_call',
      direction: 'outbound',
      recipient: twilioService.normalizeColombianPhone(to),
      content: `Emergency: ${alertType} at ${siteName}`,
      status: 'failed',
      errorMessage: err.message,
      operator: operatorName,
    }).catch(() => {});
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════
// SMS
// ══════════════════════════════════════════════════════════════

export async function sendSMS(
  tenantId: string,
  to: string,
  message: string,
  operatorName: string,
  options?: { siteId?: string },
) {
  try {
    const res = await twilioService.sendSMS(to, message);
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'sms',
      direction: 'outbound',
      recipient: twilioService.normalizeColombianPhone(to),
      content: message.substring(0, 500),
      twilioSid: res.sid,
      status: 'sent',
      costEstimate: String(estimateCost('sms')),
      siteId: options?.siteId,
      operator: operatorName,
    });
    return { success: true, sid: res.sid, status: res.status };
  } catch (err: any) {
    await db.insert(communicationLogs).values({
      tenantId,
      channel: 'sms',
      direction: 'outbound',
      recipient: twilioService.normalizeColombianPhone(to),
      content: message.substring(0, 500),
      status: 'failed',
      errorMessage: err.message,
      operator: operatorName,
    }).catch(() => {});
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════
// Communication Logs
// ══════════════════════════════════════════════════════════════

export async function getLogs(
  tenantId: string,
  filters: { page: number; limit: number; channel?: string; status?: string; fromDate?: string; toDate?: string },
) {
  const offset = (filters.page - 1) * filters.limit;
  const conditions = [eq(communicationLogs.tenantId, tenantId)];

  if (filters.channel) conditions.push(eq(communicationLogs.channel, filters.channel));
  if (filters.status) conditions.push(eq(communicationLogs.status, filters.status));
  if (filters.fromDate) conditions.push(gte(communicationLogs.createdAt, new Date(filters.fromDate)));
  if (filters.toDate) conditions.push(lte(communicationLogs.createdAt, new Date(filters.toDate)));

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(communicationLogs)
      .where(and(...conditions))
      .orderBy(desc(communicationLogs.createdAt))
      .limit(filters.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(communicationLogs)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count ?? 0,
    page: filters.page,
    limit: filters.limit,
  };
}

export async function getStats(tenantId: string) {
  const result = await db.execute(
    sql`SELECT get_communication_stats(${tenantId}) as stats`,
  );
  return (result[0] as any)?.stats ?? {};
}

// ══════════════════════════════════════════════════════════════
// Notification Rules CRUD
// ══════════════════════════════════════════════════════════════

export async function listNotificationRules(tenantId: string) {
  return db
    .select()
    .from(twilioNotificationRules)
    .where(eq(twilioNotificationRules.tenantId, tenantId))
    .orderBy(desc(twilioNotificationRules.createdAt));
}

export async function createNotificationRule(
  tenantId: string,
  input: {
    name: string;
    eventType: string;
    channel: string;
    recipientType?: string;
    recipientOverride?: string;
    messageTemplate: string;
    isActive?: boolean;
    cooldownMinutes?: number;
  },
) {
  const [row] = await db.insert(twilioNotificationRules).values({ tenantId, ...input }).returning();
  return row;
}

export async function updateNotificationRule(
  tenantId: string,
  id: string,
  input: Partial<{
    name: string;
    eventType: string;
    channel: string;
    recipientType: string;
    recipientOverride: string;
    messageTemplate: string;
    isActive: boolean;
    cooldownMinutes: number;
  }>,
) {
  const [row] = await db
    .update(twilioNotificationRules)
    .set(input)
    .where(and(eq(twilioNotificationRules.id, id), eq(twilioNotificationRules.tenantId, tenantId)))
    .returning();
  return row;
}

export async function deleteNotificationRule(tenantId: string, id: string) {
  const [row] = await db
    .delete(twilioNotificationRules)
    .where(and(eq(twilioNotificationRules.id, id), eq(twilioNotificationRules.tenantId, tenantId)))
    .returning();
  return row;
}

// ── Webhook log helpers ──────────────────────────────────────

export async function logInboundWhatsApp(
  tenantId: string,
  from: string,
  body: string,
  twilioSid: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(communicationLogs).values({
    tenantId,
    channel: 'whatsapp',
    direction: 'inbound',
    sender: from,
    content: body.substring(0, 500),
    twilioSid,
    status: 'received',
    metadata,
  });
}

export async function updateCallStatus(twilioSid: string, status: string, durationSeconds?: number) {
  await db
    .update(communicationLogs)
    .set({
      status,
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    })
    .where(eq(communicationLogs.twilioSid, twilioSid));
}

export async function updateRecordingUrl(twilioSid: string, recordingUrl: string) {
  await db
    .update(communicationLogs)
    .set({ recordingUrl })
    .where(eq(communicationLogs.twilioSid, twilioSid));
}
