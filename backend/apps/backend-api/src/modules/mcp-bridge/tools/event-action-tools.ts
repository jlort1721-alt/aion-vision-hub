/**
 * MCP Server Tool — Event Actions
 *
 * Provides tools for acknowledging, bulk-acknowledging, and dismissing
 * security events. All operations are tenant-scoped.
 */

import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { events } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── acknowledge_event ──────────────────────────────────────────

export const acknowledgeEvent: MCPServerTool = {
  name: 'acknowledge_event',
  description:
    'Acknowledge a single security event by ID. Sets status to acknowledged.',
  parameters: {
    event_id: {
      type: 'string',
      description: 'UUID of the event to acknowledge',
      required: true,
    },
    notes: {
      type: 'string',
      description: 'Optional notes for the acknowledgement',
      required: false,
    },
  },
  execute: async (params, context) => {
    const eventId = params.event_id as string;

    const [existing] = await db
      .select({ id: events.id, status: events.status })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, context.tenantId)))
      .limit(1);

    if (!existing) {
      return { error: `Event '${eventId}' not found or does not belong to this tenant` };
    }

    await db
      .update(events)
      .set({ status: 'acknowledged', updatedAt: new Date() })
      .where(and(eq(events.id, eventId), eq(events.tenantId, context.tenantId)));

    return {
      success: true,
      event_id: eventId,
      previous_status: existing.status,
      new_status: 'acknowledged',
    };
  },
};

// ── bulk_acknowledge_events ────────────────────────────────────

export const bulkAcknowledgeEvents: MCPServerTool = {
  name: 'bulk_acknowledge_events',
  description:
    'Acknowledge all new events of a given severity. Useful for clearing info/low events quickly. Returns count of acknowledged events.',
  parameters: {
    severity: {
      type: 'string',
      description: 'Severity level to filter by',
      required: true,
      enum: ['info', 'low', 'medium', 'high', 'critical'],
    },
    max: {
      type: 'number',
      description: 'Maximum number of events to acknowledge (default: 50, max: 200)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const severity = params.severity as string;
    const max = Math.min(Number(params.max) || 50, 200);

    // Find matching events
    const matching = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.tenantId, context.tenantId),
          eq(events.status, 'new'),
          eq(events.severity, severity),
        ),
      )
      .limit(max);

    if (matching.length === 0) {
      return { acknowledged: 0, message: `No new events with severity '${severity}' found` };
    }

    const ids = matching.map(e => e.id);

    await db
      .update(events)
      .set({ status: 'acknowledged', updatedAt: new Date() })
      .where(
        and(
          eq(events.tenantId, context.tenantId),
          eq(events.status, 'new'),
          eq(events.severity, severity),
          inArray(events.id, ids),
        ),
      );

    return { acknowledged: ids.length, severity };
  },
};

// ── dismiss_event ──────────────────────────────────────────────

export const dismissEvent: MCPServerTool = {
  name: 'dismiss_event',
  description:
    'Dismiss a security event with a reason (false alarm, duplicate, etc). Sets status to dismissed and records the reason in metadata.',
  parameters: {
    event_id: {
      type: 'string',
      description: 'UUID of the event to dismiss',
      required: true,
    },
    reason: {
      type: 'string',
      description: 'Reason for dismissal (e.g., false_alarm, duplicate, resolved_externally)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const eventId = params.event_id as string;
    const reason = params.reason as string;

    const [existing] = await db
      .select({ id: events.id, status: events.status, metadata: events.metadata })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, context.tenantId)))
      .limit(1);

    if (!existing) {
      return { error: `Event '${eventId}' not found or does not belong to this tenant` };
    }

    const currentMeta = (existing.metadata ?? {}) as Record<string, unknown>;
    const updatedMeta = { ...currentMeta, dismiss_reason: reason, dismissed_at: new Date().toISOString() };

    await db
      .update(events)
      .set({
        status: 'dismissed',
        metadata: updatedMeta,
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, eventId), eq(events.tenantId, context.tenantId)));

    return {
      success: true,
      event_id: eventId,
      previous_status: existing.status,
      new_status: 'dismissed',
      reason,
    };
  },
};

/** All event action tools */
export const eventActionTools: MCPServerTool[] = [
  acknowledgeEvent,
  bulkAcknowledgeEvents,
  dismissEvent,
];
