import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  slaDefinitions,
  slaTracking,
} from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateSLADefinitionInput,
  UpdateSLADefinitionInput,
  SLADefinitionFilters,
  CreateSLATrackingInput,
  UpdateSLATrackingInput,
  SLATrackingFilters,
} from './schemas.js';

export class SLAService {
  // ══════════════════════════════════════════════════════════
  // SLA DEFINITIONS
  // ══════════════════════════════════════════════════════════

  async listDefinitions(tenantId: string, filters: SLADefinitionFilters) {
    const conditions = [eq(slaDefinitions.tenantId, tenantId)];

    if (filters.severity) {
      conditions.push(eq(slaDefinitions.severity, filters.severity));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(slaDefinitions.isActive, filters.isActive));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(slaDefinitions)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(slaDefinitions)
      .where(whereClause)
      .orderBy(desc(slaDefinitions.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getDefinitionById(id: string, tenantId: string) {
    const [definition] = await db
      .select()
      .from(slaDefinitions)
      .where(and(eq(slaDefinitions.id, id), eq(slaDefinitions.tenantId, tenantId)))
      .limit(1);
    if (!definition) throw new NotFoundError('SLADefinition', id);
    return definition;
  }

  async createDefinition(data: CreateSLADefinitionInput, tenantId: string) {
    const [definition] = await db
      .insert(slaDefinitions)
      .values({
        tenantId,
        name: data.name,
        description: data.description ?? null,
        severity: data.severity,
        responseTimeMinutes: data.responseTimeMinutes,
        resolutionTimeMinutes: data.resolutionTimeMinutes,
        businessHoursOnly: data.businessHoursOnly,
        isActive: data.isActive,
      })
      .returning();
    return definition;
  }

  async updateDefinition(id: string, data: UpdateSLADefinitionInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.responseTimeMinutes !== undefined) updateData.responseTimeMinutes = data.responseTimeMinutes;
    if (data.resolutionTimeMinutes !== undefined) updateData.resolutionTimeMinutes = data.resolutionTimeMinutes;
    if (data.businessHoursOnly !== undefined) updateData.businessHoursOnly = data.businessHoursOnly;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [definition] = await db
      .update(slaDefinitions)
      .set(updateData)
      .where(and(eq(slaDefinitions.id, id), eq(slaDefinitions.tenantId, tenantId)))
      .returning();

    if (!definition) throw new NotFoundError('SLADefinition', id);
    return definition;
  }

  async deleteDefinition(id: string, tenantId: string) {
    const [definition] = await db
      .delete(slaDefinitions)
      .where(and(eq(slaDefinitions.id, id), eq(slaDefinitions.tenantId, tenantId)))
      .returning();
    if (!definition) throw new NotFoundError('SLADefinition', id);
    return definition;
  }

  // ══════════════════════════════════════════════════════════
  // SLA TRACKING
  // ══════════════════════════════════════════════════════════

  async listTracking(tenantId: string, filters: SLATrackingFilters) {
    const conditions = [eq(slaTracking.tenantId, tenantId)];

    if (filters.slaId) conditions.push(eq(slaTracking.slaId, filters.slaId));
    if (filters.status) conditions.push(eq(slaTracking.status, filters.status));
    if (filters.from) conditions.push(gte(slaTracking.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(slaTracking.createdAt, new Date(filters.to)));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(slaTracking)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(slaTracking)
      .where(whereClause)
      .orderBy(desc(slaTracking.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async createTracking(data: CreateSLATrackingInput, tenantId: string) {
    const [tracking] = await db
      .insert(slaTracking)
      .values({
        tenantId,
        slaId: data.slaId,
        incidentId: data.incidentId ?? null,
        eventId: data.eventId ?? null,
        responseDeadline: new Date(data.responseDeadline),
        resolutionDeadline: new Date(data.resolutionDeadline),
        status: 'active',
      })
      .returning();
    return tracking;
  }

  async updateTracking(id: string, data: UpdateSLATrackingInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.respondedAt !== undefined) updateData.respondedAt = new Date(data.respondedAt);
    if (data.resolvedAt !== undefined) updateData.resolvedAt = new Date(data.resolvedAt);
    if (data.status !== undefined) updateData.status = data.status;

    const [tracking] = await db
      .update(slaTracking)
      .set(updateData)
      .where(and(eq(slaTracking.id, id), eq(slaTracking.tenantId, tenantId)))
      .returning();

    if (!tracking) throw new NotFoundError('SLATracking', id);
    return tracking;
  }

  // ══════════════════════════════════════════════════════════
  // SLA STATS
  // ══════════════════════════════════════════════════════════

  async getSLAStats(tenantId: string) {
    const [result] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${slaTracking.status} = 'active')::int`,
        met: sql<number>`count(*) filter (where ${slaTracking.status} = 'met')::int`,
        breached: sql<number>`count(*) filter (where ${slaTracking.status} = 'breached')::int`,
        cancelled: sql<number>`count(*) filter (where ${slaTracking.status} = 'cancelled')::int`,
        responseBreaches: sql<number>`count(*) filter (where ${slaTracking.responseBreached} = true)::int`,
        resolutionBreaches: sql<number>`count(*) filter (where ${slaTracking.resolutionBreached} = true)::int`,
      })
      .from(slaTracking)
      .where(eq(slaTracking.tenantId, tenantId));

    return {
      total: result?.total ?? 0,
      byStatus: {
        active: result?.active ?? 0,
        met: result?.met ?? 0,
        breached: result?.breached ?? 0,
        cancelled: result?.cancelled ?? 0,
      },
      breaches: {
        response: result?.responseBreaches ?? 0,
        resolution: result?.resolutionBreaches ?? 0,
      },
    };
  }
}

export const slaService = new SLAService();
