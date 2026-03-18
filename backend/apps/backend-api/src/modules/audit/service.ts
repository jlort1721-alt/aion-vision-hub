import { eq, and, desc, asc, count, sql, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { auditLogs } from '../../db/schema/index.js';
import type { AuditQueryInput, AuditStatsQueryInput } from './schemas.js';

export class AuditService {
  /**
   * List audit logs for a tenant with filters and pagination.
   */
  async list(tenantId: string, query: AuditQueryInput) {
    const conditions = [eq(auditLogs.tenantId, tenantId)];

    if (query.userId) {
      conditions.push(eq(auditLogs.userId, query.userId));
    }
    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action));
    }
    if (query.resource) {
      conditions.push(eq(auditLogs.entityType, query.resource));
    }
    if (query.from) {
      conditions.push(gte(auditLogs.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(auditLogs.createdAt, new Date(query.to)));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(auditLogs)
      .where(whereClause);

    // Get paginated results
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 50;
    const offset = (page - 1) * perPage;

    const orderByClause = query.sortOrder === 'asc'
      ? asc(auditLogs.createdAt)
      : desc(auditLogs.createdAt);

    const items = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(perPage)
      .offset(offset);

    return {
      items,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get audit statistics for a tenant.
   * Returns aggregated counts by action type and top active users.
   */
  async getStats(tenantId: string, query?: AuditStatsQueryInput) {
    const conditions = [eq(auditLogs.tenantId, tenantId)];

    if (query?.from) {
      conditions.push(gte(auditLogs.createdAt, new Date(query.from)));
    }
    if (query?.to) {
      conditions.push(lte(auditLogs.createdAt, new Date(query.to)));
    }

    const whereClause = and(...conditions);

    // Run independent queries in parallel instead of sequentially
    const [
      [{ total }],
      actionsByType,
      actionsByResource,
      topUsers,
      recentActivity,
    ] = await Promise.all([
      db.select({ total: count() }).from(auditLogs).where(whereClause),
      db.select({ action: auditLogs.action, count: count() })
        .from(auditLogs).where(whereClause)
        .groupBy(auditLogs.action).orderBy(desc(count())),
      db.select({ resource: auditLogs.entityType, count: count() })
        .from(auditLogs).where(whereClause)
        .groupBy(auditLogs.entityType).orderBy(desc(count())),
      db.select({ userId: auditLogs.userId, userEmail: auditLogs.userEmail, count: count() })
        .from(auditLogs).where(whereClause)
        .groupBy(auditLogs.userId, auditLogs.userEmail).orderBy(desc(count())).limit(10),
      db.select({
        hour: sql<string>`date_trunc('hour', ${auditLogs.createdAt})`.as('hour'),
        count: count(),
      }).from(auditLogs).where(
        and(...conditions, gte(auditLogs.createdAt, sql`now() - interval '24 hours'`)),
      ).groupBy(sql`date_trunc('hour', ${auditLogs.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${auditLogs.createdAt})`),
    ]);

    return {
      total,
      actionsByType,
      actionsByResource,
      topUsers,
      recentActivity,
    };
  }
}

export const auditService = new AuditService();
