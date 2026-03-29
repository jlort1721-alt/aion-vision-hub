/**
 * MCP Server Tool — Alert Management
 *
 * Provides tools for querying and acknowledging alert instances.
 * All operations are tenant-scoped.
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { alertInstances } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── query_alert_instances ──────────────────────────────────────

export const queryAlertInstances: MCPServerTool = {
  name: 'query_alert_instances',
  description:
    'List alert instances with optional status and severity filters. Returns alerts ordered by creation date (newest first).',
  parameters: {
    status: {
      type: 'string',
      description: 'Filter by alert status',
      required: false,
      enum: ['firing', 'acknowledged', 'resolved'],
    },
    severity: {
      type: 'string',
      description: 'Filter by severity level',
      required: false,
      enum: ['info', 'low', 'medium', 'high', 'critical'],
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 20, max: 100)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const limit = Math.min(Number(params.limit) || 20, 100);
    const conditions = [eq(alertInstances.tenantId, context.tenantId)];

    if (params.status) {
      conditions.push(eq(alertInstances.status, params.status as string));
    }
    if (params.severity) {
      conditions.push(eq(alertInstances.severity, params.severity as string));
    }

    const results = await db
      .select({
        id: alertInstances.id,
        severity: alertInstances.severity,
        status: alertInstances.status,
        title: alertInstances.title,
        message: alertInstances.message,
        currentLevel: alertInstances.currentLevel,
        createdAt: alertInstances.createdAt,
        acknowledgedAt: alertInstances.acknowledgedAt,
        resolvedAt: alertInstances.resolvedAt,
      })
      .from(alertInstances)
      .where(and(...conditions))
      .orderBy(desc(alertInstances.createdAt))
      .limit(limit);

    return {
      alerts: results,
      total: results.length,
    };
  },
};

// ── acknowledge_alert ──────────────────────────────────────────

export const acknowledgeAlert: MCPServerTool = {
  name: 'acknowledge_alert',
  description:
    'Acknowledge an active alert instance. Sets status to acknowledged and records the acknowledging user.',
  parameters: {
    alert_id: {
      type: 'string',
      description: 'UUID of the alert instance to acknowledge',
      required: true,
    },
    notes: {
      type: 'string',
      description: 'Optional notes for the acknowledgement',
      required: false,
    },
  },
  execute: async (params, context) => {
    const alertId = params.alert_id as string;

    const [existing] = await db
      .select({ id: alertInstances.id, status: alertInstances.status })
      .from(alertInstances)
      .where(and(eq(alertInstances.id, alertId), eq(alertInstances.tenantId, context.tenantId)))
      .limit(1);

    if (!existing) {
      return { error: `Alert instance '${alertId}' not found or does not belong to this tenant` };
    }

    if (existing.status === 'acknowledged' || existing.status === 'resolved') {
      return { error: `Alert is already '${existing.status}'`, alert_id: alertId };
    }

    await db
      .update(alertInstances)
      .set({
        status: 'acknowledged',
        acknowledgedBy: context.userId,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(alertInstances.id, alertId), eq(alertInstances.tenantId, context.tenantId)));

    return {
      success: true,
      alert_id: alertId,
      previous_status: existing.status,
      new_status: 'acknowledged',
    };
  },
};

/** All alert tools */
export const alertTools: MCPServerTool[] = [
  queryAlertInstances,
  acknowledgeAlert,
];
