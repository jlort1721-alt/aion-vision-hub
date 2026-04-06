import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../../db/client.js';
import { auditLogs, profiles, events, incidents, aiSessions } from '../../db/schema/index.js';
import { createLogger } from '@aion/common-utils';
import type { ExportDataInput, DeleteDataInput, RecordConsentInput, VerifyIntegrityInput } from './schemas.js';

const logger = createLogger({ name: 'gdpr-service' });

// ── Immutable Audit Hash Chain ─────────────────────────────

let lastHashCache: Map<string, string> = new Map();

export function computeAuditHash(previousHash: string, record: Record<string, unknown>): string {
  const payload = previousHash + JSON.stringify(record, Object.keys(record).sort());
  return createHash('sha256').update(payload).digest('hex');
}

export async function getLastAuditHash(tenantId: string): Promise<string> {
  if (lastHashCache.has(tenantId)) return lastHashCache.get(tenantId)!;

  const [last] = await db
    .select({ integrityHash: sql<string>`COALESCE(${auditLogs.afterState}->>'_integrityHash', '0')` })
    .from(auditLogs)
    .where(eq(auditLogs.tenantId, tenantId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  const hash = last?.integrityHash || '0';
  lastHashCache.set(tenantId, hash);
  return hash;
}

export function updateHashCache(tenantId: string, hash: string): void {
  lastHashCache.set(tenantId, hash);
}

export async function verifyAuditIntegrity(tenantId: string, input: VerifyIntegrityInput) {
  logger.info({ tenantId }, 'Starting audit integrity verification');

  const conditions = [eq(auditLogs.tenantId, tenantId)];
  if (input.fromDate) conditions.push(gte(auditLogs.createdAt, new Date(input.fromDate)));
  if (input.toDate) conditions.push(lte(auditLogs.createdAt, new Date(input.toDate)));

  const logs = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(auditLogs.createdAt)
    .limit(10000);

  let currentHash = '0';
  let invalidRecords = 0;
  let firstInvalidAt: string | null = null;

  for (const log of logs) {
    const storedHash = (log.afterState as Record<string, unknown>)?._integrityHash as string;
    if (storedHash) {
      const record = { ...log, afterState: undefined };
      const expectedHash = computeAuditHash(currentHash, record as Record<string, unknown>);
      if (expectedHash !== storedHash) {
        invalidRecords++;
        if (!firstInvalidAt) firstInvalidAt = log.createdAt?.toISOString() || null;
      }
      currentHash = storedHash;
    }
  }

  return {
    verified: invalidRecords === 0,
    totalRecords: logs.length,
    invalidRecords,
    firstInvalidAt,
    checkedAt: new Date().toISOString(),
  };
}

// ── GDPR Data Export ───────────────────────────────────────

export async function exportUserData(userId: string, tenantId: string, input: ExportDataInput) {
  logger.info({ userId, tenantId }, 'Exporting user data (GDPR)');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.userId, userId), eq(profiles.tenantId, tenantId)))
    .limit(1);

  const result: Record<string, unknown> = {
    exportDate: new Date().toISOString(),
    format: input.format,
    profile: profile || null,
  };

  if (input.includeEvents) {
    const userEvents = await db
      .select()
      .from(events)
      .where(eq(events.tenantId, tenantId))
      .orderBy(desc(events.createdAt))
      .limit(1000);
    result.events = userEvents;
  }

  if (input.includeIncidents) {
    const userIncidents = await db
      .select()
      .from(incidents)
      .where(eq(incidents.tenantId, tenantId))
      .orderBy(desc(incidents.createdAt))
      .limit(500);
    result.incidents = userIncidents;
  }

  if (input.includeAuditLogs) {
    const userAudit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.userId, userId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(5000);
    result.auditLogs = userAudit;
  }

  const sessions = await db
    .select()
    .from(aiSessions)
    .where(and(eq(aiSessions.tenantId, tenantId), eq(aiSessions.userId, userId)))
    .limit(100);
  result.aiSessions = sessions;

  return result;
}

// ── GDPR Data Deletion ─────────────────────────────────────

export async function deleteUserData(userId: string, tenantId: string, input: DeleteDataInput) {
  logger.info({ userId, tenantId }, 'Processing data deletion request (GDPR)');

  const anonymizedName = `DELETED_USER_${userId.slice(0, 8)}`;
  const anonymizedEmail = `deleted_${userId.slice(0, 8)}@anonymized.local`;
  const deletedItems: string[] = [];
  const anonymizedItems: string[] = [];

  // Anonymize profile
  await db
    .update(profiles)
    .set({ fullName: anonymizedName, avatarUrl: null })
    .where(and(eq(profiles.userId, userId), eq(profiles.tenantId, tenantId)));
  anonymizedItems.push('profile');

  // Delete AI sessions
  await db
    .delete(aiSessions)
    .where(and(eq(aiSessions.tenantId, tenantId), eq(aiSessions.userId, userId)));
  deletedItems.push('ai_sessions');

  // Anonymize audit logs (keep for compliance but remove PII)
  if (input.retainAuditLogs) {
    await db
      .update(auditLogs)
      .set({ userEmail: anonymizedEmail })
      .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.userId, userId)));
    anonymizedItems.push('audit_logs');
  }

  return {
    userId,
    deletedItems,
    anonymizedItems,
    retainedItems: input.retainAuditLogs ? ['audit_logs (anonymized)'] : [],
    processedAt: new Date().toISOString(),
    reason: input.reason || 'User request',
  };
}

// ── Consent Management ─────────────────────────────────────

export async function recordConsent(userId: string, tenantId: string, input: RecordConsentInput) {
  // Store consent as audit log entry for immutability
  const consentRecord = {
    consentType: input.consentType,
    version: input.version,
    granted: input.granted,
    ipAddress: input.ipAddress,
    recordedAt: new Date().toISOString(),
  };

  await db.insert(auditLogs).values({
    tenantId,
    userId,
    userEmail: '',
    action: input.granted ? 'consent.granted' : 'consent.withdrawn',
    entityType: 'consent',
    entityId: input.consentType,
    afterState: consentRecord,
    ipAddress: input.ipAddress || 'unknown',
    userAgent: 'gdpr-module',
  });

  return consentRecord;
}

export async function hasBiometricConsent(tenantId: string, _subjectName: string): Promise<boolean> {
  // Check if there's a granted biometric consent for this tenant
  // We check at tenant level since individual resident consent is recorded per subject
  const [latest] = await db
    .select({ action: auditLogs.action })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.entityType, 'consent'),
        eq(auditLogs.entityId, 'biometric'),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  // If no consent record exists, or the latest action is withdrawal, return false
  return latest?.action === 'consent.granted';
}

export async function listConsents(userId: string, tenantId: string) {
  const consents = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.userId, userId),
        eq(auditLogs.entityType, 'consent'),
      ),
    )
    .orderBy(desc(auditLogs.createdAt));

  return consents.map((c) => ({
    id: c.id,
    type: c.entityId,
    action: c.action,
    details: c.afterState,
    recordedAt: c.createdAt,
  }));
}
