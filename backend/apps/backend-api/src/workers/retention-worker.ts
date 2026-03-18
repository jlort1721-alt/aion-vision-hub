// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Data Retention Policy Worker
// Enterprise compliance engine for automated, GDPR-compliant
// database garbage collection and log purging.
// ═══════════════════════════════════════════════════════════

import type { Database } from '../db/client.js';
import { auditLogs, events, incidents, playbackRequests } from '../db/schema/index.js';
import { dataRetentionPolicies } from '../db/schema/phase4.js';
import { eq, sql } from 'drizzle-orm';
import { createLoggerConfig } from '@aion/common-utils';
import pino from 'pino';

// Polling interval for garbage collection checks: Every 24 hours (86_400_000 ms)
const GARBAGE_COLLECTION_INTERVAL = 24 * 60 * 60 * 1000;
// We run the initial check 5 minutes after startup to not block early boots
const INITIAL_DELAY = 5 * 60 * 1000;

let workerInterval: NodeJS.Timeout | null = null;
const logger = pino(createLoggerConfig({ name: 'retention-worker', level: 'info' }));

export function startRetentionWorker(db: Database) {
  if (workerInterval) return;
  logger.info('Starting Data Retention Engine. Initial sweep in 5 mins.');

  setTimeout(() => {
    executeRetentionSweep(db).catch(err => {
      logger.error(`Initial retention sweep failed: ${err.message}`);
    });
    
    workerInterval = setInterval(() => {
      executeRetentionSweep(db).catch(err => {
        logger.error(`Periodic retention sweep failed: ${err.message}`);
      });
    }, GARBAGE_COLLECTION_INTERVAL);
  }, INITIAL_DELAY);
}

export function stopRetentionWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('Data Retention Engine stopped gracefully.');
  }
}

/**
 * Loops through all active policies and executes SQL deletes matching retention thresholds.
 */
async function executeRetentionSweep(db: Database) {
  logger.info('Initiating enterprise data retention sweep...');
  
  // 1. Fetch all tenant-specific active retention policies
  const policies = await db
    .select()
    .from(dataRetentionPolicies)
    .where(eq(dataRetentionPolicies.isActive, true));

  if (!policies.length) {
    logger.warn('No active data retention policies found. Skipping sweep.');
    return;
  }

  // 2. Process each policy row independently
  for (const policy of policies) {
    const tenantId = policy.tenantId;
    const days = policy.retentionDays;

    if (!days || days <= 0) continue;

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - days);
    let totalPurged = 0;

    try {
      if (policy.dataType === 'audit_logs') {
        const res = await db.delete(auditLogs as any)
          .where(sql`${auditLogs.tenantId} = ${tenantId} AND ${auditLogs.createdAt} < ${thresholdDate.toISOString()}`);
        totalPurged += res.count || 0;
      }
      else if (policy.dataType === 'event_logs') {
        const res = await db.delete(events as any)
          .where(sql`tenant_id = ${tenantId} AND timestamp < ${thresholdDate.toISOString()}`);
        totalPurged += res.count || 0;
      }
      else if (policy.dataType === 'incidents') {
        // We only purge incidents that are formally 'resolved' or 'closed'
        const res = await db.delete(incidents as any)
          .where(sql`tenant_id = ${tenantId} AND status IN ('resolved', 'closed', 'false_alarm') AND created_at < ${thresholdDate.toISOString()}`);
        totalPurged += res.count || 0;
      }
      else if (policy.dataType === 'video_footage') {
        // Only clear the proxy references in DB since storage handles its own blob retention
        const res = await db.delete(playbackRequests as any)
         .where(sql`${playbackRequests.tenantId} = ${tenantId} AND ${playbackRequests.createdAt} < ${thresholdDate.toISOString()}`);
        totalPurged += res.count || 0;
      }

      if (totalPurged > 0) {
        logger.info(`[Tenant ${tenantId}] Retention Sweep (${policy.dataType}): successfully purged ${totalPurged} stale records.`);
        
        // Update policy execution timestamp
        await db.update(dataRetentionPolicies as any)
          .set({ lastExecutedAt: new Date() })
          .where(eq(dataRetentionPolicies.id, policy.id));
      }

    } catch (err: any) {
      logger.error(`[Tenant ${tenantId}] Retention policy execution failed for ${policy.dataType}: ${err.message}`);
    }
  }

  logger.info('Retention sweep completed.');
}
