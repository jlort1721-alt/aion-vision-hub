import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { automationRules, automationExecutions } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  AutomationRuleFilters,
  AutomationExecutionFilters,
} from './schemas.js';

export class AutomationService {
  /**
   * List automation rules with filters and pagination.
   */
  async listRules(tenantId: string, filters: AutomationRuleFilters) {
    const conditions = [eq(automationRules.tenantId, tenantId)];

    if (filters.isActive !== undefined) {
      conditions.push(eq(automationRules.isActive, filters.isActive));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationRules)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / filters.perPage);
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(automationRules)
      .where(whereClause)
      .orderBy(desc(automationRules.priority), desc(automationRules.createdAt))
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
   * Get a single automation rule by ID, scoped to tenant.
   */
  async getRuleById(id: string, tenantId: string) {
    const [rule] = await db
      .select()
      .from(automationRules)
      .where(and(eq(automationRules.id, id), eq(automationRules.tenantId, tenantId)))
      .limit(1);

    if (!rule) throw new NotFoundError('AutomationRule', id);
    return rule;
  }

  /**
   * Create a new automation rule.
   */
  async createRule(data: CreateAutomationRuleInput, tenantId: string, userId: string) {
    const [rule] = await db
      .insert(automationRules)
      .values({
        tenantId,
        name: data.name,
        description: data.description ?? null,
        trigger: data.trigger,
        conditions: data.conditions ?? [],
        actions: data.actions,
        priority: data.priority,
        cooldownMinutes: data.cooldownMinutes,
        isActive: data.isActive,
        createdBy: userId,
      })
      .returning();

    return rule;
  }

  /**
   * Partially update an automation rule.
   */
  async updateRule(id: string, data: UpdateAutomationRuleInput, tenantId: string) {
    const [rule] = await db
      .update(automationRules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(automationRules.id, id), eq(automationRules.tenantId, tenantId)))
      .returning();

    if (!rule) throw new NotFoundError('AutomationRule', id);
    return rule;
  }

  /**
   * Delete an automation rule.
   */
  async deleteRule(id: string, tenantId: string) {
    const [rule] = await db
      .delete(automationRules)
      .where(and(eq(automationRules.id, id), eq(automationRules.tenantId, tenantId)))
      .returning();

    if (!rule) throw new NotFoundError('AutomationRule', id);
    return rule;
  }

  /**
   * List automation executions with filters and pagination.
   */
  async listExecutions(tenantId: string, filters: AutomationExecutionFilters) {
    const conditions = [eq(automationExecutions.tenantId, tenantId)];

    if (filters.ruleId) {
      conditions.push(eq(automationExecutions.ruleId, filters.ruleId));
    }
    if (filters.status) {
      conditions.push(eq(automationExecutions.status, filters.status));
    }
    if (filters.from) {
      conditions.push(gte(automationExecutions.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(automationExecutions.createdAt, new Date(filters.to)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationExecutions)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / filters.perPage);
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(automationExecutions)
      .where(whereClause)
      .orderBy(desc(automationExecutions.createdAt))
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
   * Get automation statistics for a tenant.
   */
  async getAutomationStats(tenantId: string) {
    // Total rules and active rules
    const [rulesStats] = await db
      .select({
        totalRules: sql<number>`count(*)::int`,
        activeRules: sql<number>`count(*) filter (where ${automationRules.isActive} = true)::int`,
      })
      .from(automationRules)
      .where(eq(automationRules.tenantId, tenantId));

    // Total executions and success rate
    const [executionStats] = await db
      .select({
        totalExecutions: sql<number>`count(*)::int`,
        successCount: sql<number>`count(*) filter (where ${automationExecutions.status} = 'success')::int`,
      })
      .from(automationExecutions)
      .where(eq(automationExecutions.tenantId, tenantId));

    // Last 24h executions
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [last24h] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(automationExecutions)
      .where(
        and(
          eq(automationExecutions.tenantId, tenantId),
          gte(automationExecutions.createdAt, twentyFourHoursAgo),
        ),
      );

    const totalExecutions = executionStats?.totalExecutions ?? 0;
    const successCount = executionStats?.successCount ?? 0;
    const successRate = totalExecutions > 0
      ? Math.round((successCount / totalExecutions) * 10000) / 100
      : 0;

    return {
      totalRules: rulesStats?.totalRules ?? 0,
      activeRules: rulesStats?.activeRules ?? 0,
      totalExecutions,
      successRate,
      executionsLast24h: last24h?.count ?? 0,
    };
  }
}

export const automationService = new AutomationService();
