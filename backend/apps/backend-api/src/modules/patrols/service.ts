import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  patrolRoutes,
  patrolCheckpoints,
  patrolLogs,
} from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateRouteInput,
  UpdateRouteInput,
  RouteFilters,
  CreateCheckpointInput,
  UpdateCheckpointInput,
  CreatePatrolLogInput,
  PatrolLogFilters,
} from './schemas.js';

export class PatrolService {
  // ══════════════════════════════════════════════════════════
  // PATROL ROUTES
  // ══════════════════════════════════════════════════════════

  async listRoutes(tenantId: string, filters: RouteFilters) {
    const conditions = [eq(patrolRoutes.tenantId, tenantId)];

    if (filters.siteId) {
      conditions.push(eq(patrolRoutes.siteId, filters.siteId));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(patrolRoutes.isActive, filters.isActive));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patrolRoutes)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(patrolRoutes)
      .where(whereClause)
      .orderBy(desc(patrolRoutes.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getRouteById(id: string, tenantId: string) {
    const [route] = await db
      .select()
      .from(patrolRoutes)
      .where(and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)))
      .limit(1);
    if (!route) throw new NotFoundError('PatrolRoute', id);
    return route;
  }

  async createRoute(data: CreateRouteInput, tenantId: string) {
    const [route] = await db
      .insert(patrolRoutes)
      .values({
        tenantId,
        siteId: data.siteId,
        name: data.name,
        description: data.description ?? null,
        estimatedMinutes: data.estimatedMinutes,
        frequencyMinutes: data.frequencyMinutes,
        isActive: data.isActive,
      })
      .returning();
    return route;
  }

  async updateRoute(id: string, data: UpdateRouteInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.siteId !== undefined) updateData.siteId = data.siteId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.estimatedMinutes !== undefined) updateData.estimatedMinutes = data.estimatedMinutes;
    if (data.frequencyMinutes !== undefined) updateData.frequencyMinutes = data.frequencyMinutes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [route] = await db
      .update(patrolRoutes)
      .set(updateData)
      .where(and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)))
      .returning();

    if (!route) throw new NotFoundError('PatrolRoute', id);
    return route;
  }

  async deleteRoute(id: string, tenantId: string) {
    const [route] = await db
      .delete(patrolRoutes)
      .where(and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)))
      .returning();
    if (!route) throw new NotFoundError('PatrolRoute', id);
    return route;
  }

  // ══════════════════════════════════════════════════════════
  // CHECKPOINTS
  // ══════════════════════════════════════════════════════════

  async listCheckpointsByRoute(routeId: string, tenantId: string) {
    return db
      .select()
      .from(patrolCheckpoints)
      .where(and(eq(patrolCheckpoints.routeId, routeId), eq(patrolCheckpoints.tenantId, tenantId)))
      .orderBy(patrolCheckpoints.order);
  }

  async createCheckpoint(routeId: string, data: CreateCheckpointInput, tenantId: string) {
    // Verify the route exists and belongs to this tenant
    await this.getRouteById(routeId, tenantId);

    const [checkpoint] = await db
      .insert(patrolCheckpoints)
      .values({
        tenantId,
        routeId,
        name: data.name,
        description: data.description ?? null,
        location: data.location ?? null,
        order: data.order,
        qrCode: data.qrCode ?? null,
        requiredPhoto: data.requiredPhoto,
      })
      .returning();
    return checkpoint;
  }

  async updateCheckpoint(id: string, data: UpdateCheckpointInput, tenantId: string) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.qrCode !== undefined) updateData.qrCode = data.qrCode;
    if (data.requiredPhoto !== undefined) updateData.requiredPhoto = data.requiredPhoto;

    const [checkpoint] = await db
      .update(patrolCheckpoints)
      .set(updateData)
      .where(and(eq(patrolCheckpoints.id, id), eq(patrolCheckpoints.tenantId, tenantId)))
      .returning();

    if (!checkpoint) throw new NotFoundError('PatrolCheckpoint', id);
    return checkpoint;
  }

  async deleteCheckpoint(id: string, tenantId: string) {
    const [checkpoint] = await db
      .delete(patrolCheckpoints)
      .where(and(eq(patrolCheckpoints.id, id), eq(patrolCheckpoints.tenantId, tenantId)))
      .returning();
    if (!checkpoint) throw new NotFoundError('PatrolCheckpoint', id);
    return checkpoint;
  }

  // ══════════════════════════════════════════════════════════
  // PATROL LOGS
  // ══════════════════════════════════════════════════════════

  async createLog(data: CreatePatrolLogInput, tenantId: string, userId: string) {
    const [log] = await db
      .insert(patrolLogs)
      .values({
        tenantId,
        routeId: data.routeId,
        checkpointId: data.checkpointId ?? null,
        userId,
        status: data.status,
        scannedAt: data.scannedAt ? new Date(data.scannedAt) : new Date(),
        notes: data.notes ?? null,
        photoUrl: data.photoUrl ?? null,
      })
      .returning();
    return log;
  }

  async listLogs(tenantId: string, filters: PatrolLogFilters) {
    const conditions = [eq(patrolLogs.tenantId, tenantId)];

    if (filters.routeId) conditions.push(eq(patrolLogs.routeId, filters.routeId));
    if (filters.userId) conditions.push(eq(patrolLogs.userId, filters.userId));
    if (filters.status) conditions.push(eq(patrolLogs.status, filters.status));
    if (filters.from) conditions.push(gte(patrolLogs.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(patrolLogs.createdAt, new Date(filters.to)));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patrolLogs)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(patrolLogs)
      .where(whereClause)
      .orderBy(desc(patrolLogs.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  // ══════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════

  async getPatrolStats(tenantId: string) {
    const [result] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${patrolLogs.status} = 'completed')::int`,
        missed: sql<number>`count(*) filter (where ${patrolLogs.status} = 'missed')::int`,
        skipped: sql<number>`count(*) filter (where ${patrolLogs.status} = 'skipped')::int`,
        incident: sql<number>`count(*) filter (where ${patrolLogs.status} = 'incident')::int`,
      })
      .from(patrolLogs)
      .where(eq(patrolLogs.tenantId, tenantId));

    const total = result?.total ?? 0;
    const completed = result?.completed ?? 0;
    const missed = result?.missed ?? 0;

    return {
      total,
      byStatus: {
        completed,
        missed,
        skipped: result?.skipped ?? 0,
        incident: result?.incident ?? 0,
      },
      complianceRate: total > 0 ? Math.round((completed / (completed + missed)) * 10000) / 100 : 0,
    };
  }
}

export const patrolService = new PatrolService();
