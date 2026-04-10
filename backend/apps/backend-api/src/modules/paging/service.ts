import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { pagingBroadcasts, pagingTemplates, sites } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { BroadcastInput, BroadcastFilters, PagingTemplateInput } from './schemas.js';

export class PagingService {
  async broadcast(tenantId: string, userId: string, input: BroadcastInput) {
    const [row] = await db
      .insert(pagingBroadcasts)
      .values({
        tenantId,
        message: input.message,
        targetSites: input.targetSites,
        targetZones: input.targetZones ?? [],
        priority: input.priority,
        status: 'completed',
        initiatedBy: userId,
        completedAt: new Date(),
      })
      .returning();
    return row;
  }

  async emergencyBroadcast(tenantId: string, userId: string, input: BroadcastInput) {
    const [row] = await db
      .insert(pagingBroadcasts)
      .values({
        tenantId,
        message: input.message,
        targetSites: input.targetSites,
        targetZones: input.targetZones ?? [],
        priority: 'emergency',
        status: 'completed',
        initiatedBy: userId,
        completedAt: new Date(),
      })
      .returning();
    return row;
  }

  async listZones(tenantId: string) {
    const rows = await db
      .select({ siteId: sites.id, siteName: sites.name })
      .from(sites)
      .where(eq(sites.tenantId, tenantId))
      .orderBy(sites.name);

    return rows;
  }

  async getHistory(tenantId: string, filters: BroadcastFilters) {
    const conditions = [eq(pagingBroadcasts.tenantId, tenantId)];

    if (filters.priority) conditions.push(eq(pagingBroadcasts.priority, filters.priority));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pagingBroadcasts)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(pagingBroadcasts)
      .where(whereClause)
      .orderBy(desc(pagingBroadcasts.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async listTemplates(tenantId: string) {
    const rows = await db
      .select()
      .from(pagingTemplates)
      .where(eq(pagingTemplates.tenantId, tenantId))
      .orderBy(pagingTemplates.name);

    return rows;
  }

  async createTemplate(tenantId: string, data: PagingTemplateInput) {
    const [row] = await db
      .insert(pagingTemplates)
      .values({
        tenantId,
        name: data.name,
        message: data.message,
        priority: data.priority,
        isEmergency: data.isEmergency,
      })
      .returning();
    return row;
  }

  async deleteTemplate(id: string, tenantId: string) {
    const [row] = await db
      .delete(pagingTemplates)
      .where(and(eq(pagingTemplates.id, id), eq(pagingTemplates.tenantId, tenantId)))
      .returning();
    if (!row) throw new NotFoundError('PagingTemplate', id);
    return row;
  }
}

export const pagingService = new PagingService();
