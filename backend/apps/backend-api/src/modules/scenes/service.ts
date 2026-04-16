import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { domoticScenes, domoticSceneExecutions } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateSceneInput, UpdateSceneInput, ListScenesFilter, SceneAction } from './schemas.js';

export class SceneService {
  async list(tenantId: string, filters: ListScenesFilter) {
    const conditions = [eq(domoticScenes.tenantId, tenantId)];

    if (filters.siteId) conditions.push(eq(domoticScenes.siteId, filters.siteId));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(domoticScenes)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(domoticScenes)
      .where(whereClause)
      .orderBy(desc(domoticScenes.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getById(id: string, tenantId: string) {
    const [row] = await db
      .select()
      .from(domoticScenes)
      .where(and(eq(domoticScenes.id, id), eq(domoticScenes.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new NotFoundError('DomoticScene', id);
    return row;
  }

  async create(tenantId: string, userId: string, data: CreateSceneInput) {
    const [row] = await db
      .insert(domoticScenes)
      .values({
        tenantId,
        name: data.name,
        siteId: data.siteId,
        icon: data.icon,
        description: data.description,
        actions: data.actions,
        isActive: data.isActive,
        createdBy: userId,
      })
      .returning();
    return row;
  }

  async update(id: string, tenantId: string, data: UpdateSceneInput) {
    const [row] = await db
      .update(domoticScenes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(domoticScenes.id, id), eq(domoticScenes.tenantId, tenantId)))
      .returning();
    if (!row) throw new NotFoundError('DomoticScene', id);
    return row;
  }

  async delete(id: string, tenantId: string) {
    const [row] = await db
      .delete(domoticScenes)
      .where(and(eq(domoticScenes.id, id), eq(domoticScenes.tenantId, tenantId)))
      .returning();
    if (!row) throw new NotFoundError('DomoticScene', id);
    return row;
  }

  async execute(id: string, tenantId: string, userId: string) {
    const scene = await this.getById(id, tenantId);

    if (!scene.isActive) {
      throw new Error('Scene is inactive and cannot be executed');
    }

    const startTime = Date.now();
    const actions = (scene.actions as SceneAction[]) ?? [];

    const results = actions.map((action) => ({
      deviceId: action.deviceId,
      action: action.action,
      status: 'executed' as const,
    }));

    const executionTimeMs = Date.now() - startTime;

    const [execution] = await db
      .insert(domoticSceneExecutions)
      .values({
        sceneId: id,
        tenantId,
        executedBy: userId,
        result: results,
        status: 'completed',
        executionTimeMs,
      })
      .returning();

    return execution;
  }

  async listExecutions(tenantId: string, sceneId?: string, limit = 20) {
    const conditions = [eq(domoticSceneExecutions.tenantId, tenantId)];

    if (sceneId) conditions.push(eq(domoticSceneExecutions.sceneId, sceneId));

    const rows = await db
      .select()
      .from(domoticSceneExecutions)
      .where(and(...conditions))
      .orderBy(desc(domoticSceneExecutions.createdAt))
      .limit(limit);

    return rows;
  }
}

export const sceneService = new SceneService();
