import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  alertRules,
  alertInstances,
  escalationPolicies,
  notificationChannels,
  notificationLog,
} from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
  AlertRuleFilters,
  AlertInstanceFilters,
  CreateEscalationPolicyInput,
  UpdateEscalationPolicyInput,
  CreateNotificationChannelInput,
  UpdateNotificationChannelInput,
  NotificationLogFilters,
} from './schemas.js';

export class AlertService {
  // ══════════════════════════════════════════════════════════
  // ALERT RULES
  // ══════════════════════════════════════════════════════════

  async listRules(tenantId: string, filters: AlertRuleFilters) {
    const conditions = [eq(alertRules.tenantId, tenantId)];

    if (filters.isActive !== undefined) {
      conditions.push(eq(alertRules.isActive, filters.isActive));
    }
    if (filters.severity) {
      conditions.push(eq(alertRules.severity, filters.severity));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alertRules)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(alertRules)
      .where(whereClause)
      .orderBy(desc(alertRules.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getRuleById(id: string, tenantId: string) {
    const [rule] = await db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)))
      .limit(1);
    if (!rule) throw new NotFoundError('AlertRule', id);
    return rule;
  }

  async createRule(data: CreateAlertRuleInput, tenantId: string, userId: string) {
    const [rule] = await db
      .insert(alertRules)
      .values({
        tenantId,
        name: data.name,
        description: data.description ?? null,
        conditions: data.conditions,
        actions: data.actions,
        severity: data.severity,
        cooldownMinutes: data.cooldownMinutes,
        isActive: data.isActive,
        createdBy: userId,
      })
      .returning();
    return rule;
  }

  async updateRule(id: string, data: UpdateAlertRuleInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
    if (data.actions !== undefined) updateData.actions = data.actions;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.cooldownMinutes !== undefined) updateData.cooldownMinutes = data.cooldownMinutes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [rule] = await db
      .update(alertRules)
      .set(updateData)
      .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)))
      .returning();

    if (!rule) throw new NotFoundError('AlertRule', id);
    return rule;
  }

  async deleteRule(id: string, tenantId: string) {
    const [rule] = await db
      .delete(alertRules)
      .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)))
      .returning();
    if (!rule) throw new NotFoundError('AlertRule', id);
    return rule;
  }

  /**
   * Seed default alert rules for a tenant if none exist.
   * Returns the number of rules created (0 if rules already exist).
   */
  async seedDefaultRules(tenantId: string, userId: string): Promise<number> {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alertRules)
      .where(eq(alertRules.tenantId, tenantId));

    if ((countResult?.count ?? 0) > 0) return 0;

    const defaults = [
      {
        name: 'Eventos Críticos',
        description: 'Alerta automática para eventos de severidad crítica',
        conditions: { severity: 'critical' },
        actions: { createInstance: true },
        severity: 'critical' as const,
        cooldownMinutes: 5,
      },
      {
        name: 'Eventos Alta Severidad',
        description: 'Alerta automática para eventos de severidad alta',
        conditions: { severity: 'high' },
        actions: { createInstance: true },
        severity: 'high' as const,
        cooldownMinutes: 10,
      },
      {
        name: 'Dispositivo Offline',
        description: 'Alerta cuando un dispositivo cambia a estado offline',
        conditions: { eventType: 'device_offline' },
        actions: { createInstance: true },
        severity: 'high' as const,
        cooldownMinutes: 15,
      },
      {
        name: 'Detección de Movimiento',
        description: 'Alerta para eventos de detección de movimiento',
        conditions: { eventType: 'motion_detection' },
        actions: { createInstance: true },
        severity: 'medium' as const,
        cooldownMinutes: 5,
      },
    ];

    const inserted = await db
      .insert(alertRules)
      .values(
        defaults.map((d) => ({
          tenantId,
          name: d.name,
          description: d.description,
          conditions: d.conditions,
          actions: d.actions,
          severity: d.severity,
          cooldownMinutes: d.cooldownMinutes,
          isActive: true,
          createdBy: userId,
        })),
      )
      .returning({ id: alertRules.id });

    return inserted.length;
  }

  // ══════════════════════════════════════════════════════════
  // ALERT INSTANCES
  // ══════════════════════════════════════════════════════════

  async listInstances(tenantId: string, filters: AlertInstanceFilters) {
    const conditions = [eq(alertInstances.tenantId, tenantId)];

    if (filters.status) conditions.push(eq(alertInstances.status, filters.status));
    if (filters.severity) conditions.push(eq(alertInstances.severity, filters.severity));
    if (filters.ruleId) conditions.push(eq(alertInstances.ruleId, filters.ruleId));
    if (filters.from) conditions.push(gte(alertInstances.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(alertInstances.createdAt, new Date(filters.to)));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alertInstances)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(alertInstances)
      .where(whereClause)
      .orderBy(desc(alertInstances.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getInstanceById(id: string, tenantId: string) {
    const [instance] = await db
      .select()
      .from(alertInstances)
      .where(and(eq(alertInstances.id, id), eq(alertInstances.tenantId, tenantId)))
      .limit(1);
    if (!instance) throw new NotFoundError('AlertInstance', id);
    return instance;
  }

  async acknowledgeInstance(id: string, tenantId: string, userId: string) {
    const now = new Date();
    const [instance] = await db
      .update(alertInstances)
      .set({
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: now,
        nextEscalationAt: null,
        updatedAt: now,
      })
      .where(and(eq(alertInstances.id, id), eq(alertInstances.tenantId, tenantId)))
      .returning();

    if (!instance) throw new NotFoundError('AlertInstance', id);
    return instance;
  }

  async resolveInstance(id: string, tenantId: string, userId: string) {
    const now = new Date();
    const [instance] = await db
      .update(alertInstances)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: now,
        nextEscalationAt: null,
        updatedAt: now,
      })
      .where(and(eq(alertInstances.id, id), eq(alertInstances.tenantId, tenantId)))
      .returning();

    if (!instance) throw new NotFoundError('AlertInstance', id);
    return instance;
  }

  async getInstanceStats(tenantId: string) {
    const [result] = await db
      .select({
        total: sql<number>`count(*)::int`,
        firing: sql<number>`count(*) filter (where ${alertInstances.status} = 'firing')::int`,
        acknowledged: sql<number>`count(*) filter (where ${alertInstances.status} = 'acknowledged')::int`,
        resolved: sql<number>`count(*) filter (where ${alertInstances.status} = 'resolved')::int`,
        critical: sql<number>`count(*) filter (where ${alertInstances.severity} = 'critical' and ${alertInstances.status} = 'firing')::int`,
        high: sql<number>`count(*) filter (where ${alertInstances.severity} = 'high' and ${alertInstances.status} = 'firing')::int`,
      })
      .from(alertInstances)
      .where(eq(alertInstances.tenantId, tenantId));

    return {
      total: result?.total ?? 0,
      byStatus: {
        firing: result?.firing ?? 0,
        acknowledged: result?.acknowledged ?? 0,
        resolved: result?.resolved ?? 0,
      },
      activeCritical: result?.critical ?? 0,
      activeHigh: result?.high ?? 0,
    };
  }

  // ══════════════════════════════════════════════════════════
  // ESCALATION POLICIES
  // ══════════════════════════════════════════════════════════

  async listPolicies(tenantId: string) {
    return db
      .select()
      .from(escalationPolicies)
      .where(eq(escalationPolicies.tenantId, tenantId))
      .orderBy(desc(escalationPolicies.createdAt));
  }

  async createPolicy(data: CreateEscalationPolicyInput, tenantId: string) {
    const [policy] = await db
      .insert(escalationPolicies)
      .values({
        tenantId,
        name: data.name,
        description: data.description ?? null,
        levels: data.levels,
        isActive: data.isActive,
      })
      .returning();
    return policy;
  }

  async updatePolicy(id: string, data: UpdateEscalationPolicyInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.levels !== undefined) updateData.levels = data.levels;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [policy] = await db
      .update(escalationPolicies)
      .set(updateData)
      .where(and(eq(escalationPolicies.id, id), eq(escalationPolicies.tenantId, tenantId)))
      .returning();

    if (!policy) throw new NotFoundError('EscalationPolicy', id);
    return policy;
  }

  async deletePolicy(id: string, tenantId: string) {
    const [policy] = await db
      .delete(escalationPolicies)
      .where(and(eq(escalationPolicies.id, id), eq(escalationPolicies.tenantId, tenantId)))
      .returning();
    if (!policy) throw new NotFoundError('EscalationPolicy', id);
    return policy;
  }

  // ══════════════════════════════════════════════════════════
  // NOTIFICATION CHANNELS
  // ══════════════════════════════════════════════════════════

  async listChannels(tenantId: string) {
    return db
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.tenantId, tenantId))
      .orderBy(desc(notificationChannels.createdAt));
  }

  async createChannel(data: CreateNotificationChannelInput, tenantId: string) {
    const [channel] = await db
      .insert(notificationChannels)
      .values({
        tenantId,
        name: data.name,
        type: data.type,
        config: data.config,
        isActive: data.isActive,
      })
      .returning();
    return channel;
  }

  async updateChannel(id: string, data: UpdateNotificationChannelInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [channel] = await db
      .update(notificationChannels)
      .set(updateData)
      .where(and(eq(notificationChannels.id, id), eq(notificationChannels.tenantId, tenantId)))
      .returning();

    if (!channel) throw new NotFoundError('NotificationChannel', id);
    return channel;
  }

  async deleteChannel(id: string, tenantId: string) {
    const [channel] = await db
      .delete(notificationChannels)
      .where(and(eq(notificationChannels.id, id), eq(notificationChannels.tenantId, tenantId)))
      .returning();
    if (!channel) throw new NotFoundError('NotificationChannel', id);
    return channel;
  }

  // ══════════════════════════════════════════════════════════
  // NOTIFICATION LOG
  // ══════════════════════════════════════════════════════════

  async listNotificationLogs(tenantId: string, filters: NotificationLogFilters) {
    const conditions = [eq(notificationLog.tenantId, tenantId)];

    if (filters.type) conditions.push(eq(notificationLog.type, filters.type));
    if (filters.status) conditions.push(eq(notificationLog.status, filters.status));
    if (filters.from) conditions.push(gte(notificationLog.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(notificationLog.createdAt, new Date(filters.to)));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationLog)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(notificationLog)
      .where(whereClause)
      .orderBy(desc(notificationLog.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }
}

export const alertService = new AlertService();
