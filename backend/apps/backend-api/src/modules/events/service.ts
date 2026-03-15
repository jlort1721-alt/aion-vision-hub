import { eq, and, sql, desc, asc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { events } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateEventInput,
  AssignEventInput,
  UpdateEventStatusInput,
  EventFilters,
} from './schemas.js';

export class EventService {
  /**
   * List events with filters and pagination.
   */
  async list(tenantId: string, filters: EventFilters) {
    const conditions = [eq(events.tenantId, tenantId)];

    if (filters.severity) {
      conditions.push(eq(events.severity, filters.severity));
    }
    if (filters.status) {
      conditions.push(eq(events.status, filters.status));
    }
    if (filters.deviceId) {
      conditions.push(eq(events.deviceId, filters.deviceId));
    }
    if (filters.siteId) {
      conditions.push(eq(events.siteId, filters.siteId));
    }
    if (filters.assignedTo) {
      conditions.push(eq(events.assignedTo, filters.assignedTo));
    }
    if (filters.from) {
      conditions.push(gte(events.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(events.createdAt, new Date(filters.to)));
    }

    const whereClause = and(...conditions);

    // Count total matching rows for pagination meta
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / filters.perPage);
    const offset = (filters.page - 1) * filters.perPage;

    // Determine sort column
    const sortColumn = {
      createdAt: events.createdAt,
      severity: events.severity,
      status: events.status,
    }[filters.sortBy];

    const orderFn = filters.sortOrder === 'asc' ? asc : desc;

    const rows = await db
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: {
        page: filters.page,
        perPage: filters.perPage,
        total,
        totalPages,
      },
    };
  }

  /**
   * Create a new event (typically from gateway or system integration).
   */
  async create(data: CreateEventInput, tenantId: string) {
    const [event] = await db
      .insert(events)
      .values({
        tenantId,
        deviceId: data.deviceId,
        siteId: data.siteId,
        type: data.type,
        severity: data.severity,
        title: data.title,
        description: data.description ?? null,
        channel: data.channel ?? null,
        snapshotUrl: data.snapshotUrl ?? null,
        metadata: data.metadata ?? {},
        status: 'new',
      })
      .returning();

    return event;
  }

  /**
   * Assign an event to a user.
   */
  async assign(id: string, data: AssignEventInput, tenantId: string) {
    const [event] = await db
      .update(events)
      .set({
        assignedTo: data.assignedTo,
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, id), eq(events.tenantId, tenantId)))
      .returning();

    if (!event) throw new NotFoundError('Event', id);
    return event;
  }

  /**
   * Update the status of an event (acknowledge, resolve, dismiss).
   */
  async updateStatus(id: string, data: UpdateEventStatusInput, tenantId: string) {
    const now = new Date();
    const timestampFields: Record<string, Date> = {};

    if (data.status === 'acknowledged') {
      timestampFields.acknowledgedAt = now;
    } else if (data.status === 'resolved') {
      timestampFields.resolvedAt = now;
    }

    const [event] = await db
      .update(events)
      .set({
        status: data.status,
        ...timestampFields,
        updatedAt: now,
      })
      .where(and(eq(events.id, id), eq(events.tenantId, tenantId)))
      .returning();

    if (!event) throw new NotFoundError('Event', id);
    return event;
  }

  /**
   * Get aggregated event statistics by severity and status.
   */
  async getStats(tenantId: string) {
    // Single query with conditional aggregation instead of 3 separate queries
    const [result] = await db
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
        high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
        medium: sql<number>`count(*) filter (where ${events.severity} = 'medium')::int`,
        low: sql<number>`count(*) filter (where ${events.severity} = 'low')::int`,
        info: sql<number>`count(*) filter (where ${events.severity} = 'info')::int`,
        status_new: sql<number>`count(*) filter (where ${events.status} = 'new')::int`,
        status_acknowledged: sql<number>`count(*) filter (where ${events.status} = 'acknowledged')::int`,
        status_resolved: sql<number>`count(*) filter (where ${events.status} = 'resolved')::int`,
        status_dismissed: sql<number>`count(*) filter (where ${events.status} = 'dismissed')::int`,
      })
      .from(events)
      .where(eq(events.tenantId, tenantId));

    return {
      total: result?.total ?? 0,
      bySeverity: {
        critical: result?.critical ?? 0,
        high: result?.high ?? 0,
        medium: result?.medium ?? 0,
        low: result?.low ?? 0,
        info: result?.info ?? 0,
      },
      byStatus: {
        new: result?.status_new ?? 0,
        acknowledged: result?.status_acknowledged ?? 0,
        resolved: result?.status_resolved ?? 0,
        dismissed: result?.status_dismissed ?? 0,
      },
    };
  }
}

export const eventService = new EventService();
