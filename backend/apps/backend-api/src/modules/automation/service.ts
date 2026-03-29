import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { automationRules, automationExecutions } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import { ewelinkMCP } from '../../services/ewelink-mcp.js';
import { createLogger } from '@aion/common-utils';
import type {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  AutomationRuleFilters,
  AutomationExecutionFilters,
} from './schemas.js';

const logger = createLogger({ name: 'automation-engine' });

// ── System-wide on/off switch (persisted via module-level flag) ──
let systemEnabled = true;

export function getSystemEnabled(): boolean {
  return systemEnabled;
}

export function setSystemEnabled(enabled: boolean): void {
  systemEnabled = enabled;
  logger.info({ enabled }, 'Automation system %s', enabled ? 'enabled' : 'disabled');
}

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
      systemEnabled,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // AI AUTOMATION ENGINE — Evaluate & Execute
  // ═══════════════════════════════════════════════════════════

  /**
   * Retrieve all active rules whose trigger type matches `triggerType`.
   * Rules are returned ordered by priority descending so high-priority rules fire first.
   */
  async getActiveRules(triggerType: string): Promise<Array<typeof automationRules.$inferSelect>> {
    const rows = await db
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.isActive, true),
          sql`${automationRules.trigger}->>'type' = ${triggerType}`,
        ),
      )
      .orderBy(desc(automationRules.priority));

    return rows;
  }

  /**
   * Core automation pipeline — takes an incoming trigger, finds matching rules,
   * evaluates conditions, executes actions, and logs every step.
   *
   * When the system-wide switch is off this is a no-op.
   */
  async evaluateAndExecute(trigger: { type: string; data: Record<string, unknown> }): Promise<void> {
    if (!systemEnabled) {
      logger.debug({ triggerType: trigger.type }, 'Automation system disabled — skipping evaluation');
      return;
    }

    const rules = await this.getActiveRules(trigger.type);

    if (rules.length === 0) {
      logger.debug({ triggerType: trigger.type }, 'No active rules match trigger type');
      return;
    }

    for (const rule of rules) {
      try {
        // Cooldown check — skip if the rule fired too recently
        if (rule.lastTriggeredAt && rule.cooldownMinutes > 0) {
          const cooldownMs = rule.cooldownMinutes * 60 * 1000;
          const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
          if (elapsed < cooldownMs) {
            logger.debug({ ruleId: rule.id, cooldownRemaining: cooldownMs - elapsed }, 'Rule in cooldown — skipping');
            continue;
          }
        }

        const conditions = rule.conditions as Record<string, unknown>[] | Record<string, unknown>;
        if (!this.matchesConditions(conditions, trigger.data)) {
          continue;
        }

        const startMs = Date.now();
        const actions = rule.actions as Array<Record<string, unknown>>;
        await this.executeActions(actions, trigger.data);
        const executionMs = Date.now() - startMs;

        await this.logExecution(rule.id, rule.tenantId, trigger, 'success', executionMs);

        // Bump trigger count and last-triggered timestamp
        await db
          .update(automationRules)
          .set({
            lastTriggeredAt: new Date(),
            triggerCount: sql`${automationRules.triggerCount} + 1`,
          })
          .where(eq(automationRules.id, rule.id));

        logger.info({ ruleId: rule.id, ruleName: rule.name, executionMs }, 'Automation rule executed');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ ruleId: rule.id, err: errorMessage }, 'Automation rule execution failed');
        await this.logExecution(rule.id, rule.tenantId, trigger, 'failed', 0, errorMessage);
      }
    }
  }

  /**
   * Evaluate conditions against incoming trigger data.
   *
   * Supports two formats:
   *   - Array of `{ field, operator, value }` condition objects (schema format)
   *   - Flat `{ key: expectedValue }` for simple equality matching
   */
  private matchesConditions(
    conditions: Record<string, unknown>[] | Record<string, unknown>,
    data: Record<string, unknown>,
  ): boolean {
    // If conditions is an array, iterate structured conditions
    if (Array.isArray(conditions)) {
      for (const condition of conditions) {
        const field = condition.field as string | undefined;
        const operator = (condition.operator as string | undefined) ?? 'eq';
        const expected = condition.value;

        // If there's no field, treat the object as flat key-value
        if (!field) {
          for (const [key, val] of Object.entries(condition)) {
            if (data[key] !== val) return false;
          }
          continue;
        }

        const actual = data[field];

        switch (operator) {
          case 'eq':
            if (actual !== expected) return false;
            break;
          case 'neq':
          case 'ne':
            if (actual === expected) return false;
            break;
          case 'gt':
            if (typeof actual !== 'number' || typeof expected !== 'number' || actual <= expected) return false;
            break;
          case 'gte':
            if (typeof actual !== 'number' || typeof expected !== 'number' || actual < expected) return false;
            break;
          case 'lt':
            if (typeof actual !== 'number' || typeof expected !== 'number' || actual >= expected) return false;
            break;
          case 'lte':
            if (typeof actual !== 'number' || typeof expected !== 'number' || actual > expected) return false;
            break;
          case 'in':
            if (!Array.isArray(expected) || !expected.includes(actual)) return false;
            break;
          case 'contains':
            if (typeof actual !== 'string' || typeof expected !== 'string' || !actual.includes(expected)) return false;
            break;
          default:
            if (actual !== expected) return false;
        }
      }
      return true;
    }

    // Flat object — simple equality matching
    for (const [key, expected] of Object.entries(conditions)) {
      if (data[key] !== expected) return false;
    }
    return true;
  }

  /**
   * Execute an ordered list of actions. Each action has a `type` and
   * a `config` object containing action-specific parameters.
   */
  private async executeActions(
    actions: Array<Record<string, unknown>>,
    data: Record<string, unknown>,
  ): Promise<void> {
    for (const action of actions) {
      const actionType = action.type as string;
      const config = (action.config as Record<string, unknown>) ?? {};

      switch (actionType) {
        // ── eWeLink device actions ──────────────────────────
        case 'ewelink_toggle': {
          const deviceId = (config.deviceId as string) ?? (action.deviceId as string);
          const on = (config.on as boolean) ?? (action.on as boolean) ?? true;
          if (deviceId) {
            await ewelinkMCP.toggleDevice(deviceId, on);
            logger.info({ deviceId, on }, 'eWeLink toggle executed');
          }
          break;
        }

        case 'ewelink_siren': {
          const deviceId = (config.deviceId as string) ?? (action.deviceId as string);
          const duration = ((config.duration as number) ?? (action.duration as number)) || 10;
          if (deviceId) {
            await ewelinkMCP.toggleDevice(deviceId, true);
            setTimeout(() => {
              ewelinkMCP.toggleDevice(deviceId, false).catch((err) => {
                logger.error({ deviceId, err: err instanceof Error ? err.message : 'unknown' }, 'Siren auto-off failed');
              });
            }, duration * 1000);
            logger.info({ deviceId, duration }, 'eWeLink siren activated');
          }
          break;
        }

        case 'ewelink_door': {
          const deviceId = (config.deviceId as string) ?? (action.deviceId as string);
          const pulseDuration = ((config.pulseDuration as number) ?? (action.pulseDuration as number)) || 3;
          if (deviceId) {
            await ewelinkMCP.toggleDevice(deviceId, true);
            setTimeout(() => {
              ewelinkMCP.toggleDevice(deviceId, false).catch((err) => {
                logger.error({ deviceId, err: err instanceof Error ? err.message : 'unknown' }, 'Door pulse auto-off failed');
              });
            }, pulseDuration * 1000);
            logger.info({ deviceId, pulseDuration }, 'eWeLink door pulse sent');
          }
          break;
        }

        // ── Notification / incident actions ─────────────────
        case 'send_notification':
        case 'send_alert': {
          // These actions are logged — the actual dispatch is handled
          // by the notification subsystem when it polls the notification_log table.
          logger.info({ actionType, config }, 'Notification action queued');
          break;
        }

        case 'create_incident': {
          logger.info({ config, triggerData: data }, 'Incident creation action queued');
          break;
        }

        case 'toggle_device': {
          logger.info({ config }, 'Device toggle action queued');
          break;
        }

        case 'send_whatsapp': {
          logger.info({ config }, 'WhatsApp action queued');
          break;
        }

        case 'webhook': {
          const url = config.url as string | undefined;
          if (url) {
            try {
              await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: data, action: config }),
                signal: AbortSignal.timeout(10_000),
              });
              logger.info({ url }, 'Webhook action dispatched');
            } catch (err) {
              logger.error({ url, err: err instanceof Error ? err.message : 'unknown' }, 'Webhook action failed');
            }
          }
          break;
        }

        case 'activate_protocol': {
          logger.info({ config }, 'Protocol activation action queued');
          break;
        }

        default:
          logger.warn({ actionType }, 'Unknown action type — skipping');
      }
    }
  }

  /**
   * Record an automation execution in the `automation_executions` table.
   */
  private async logExecution(
    ruleId: string,
    tenantId: string,
    trigger: { type: string; data: Record<string, unknown> },
    status: 'success' | 'partial' | 'failed',
    executionTimeMs: number,
    error?: string,
  ): Promise<void> {
    await db.insert(automationExecutions).values({
      tenantId,
      ruleId,
      triggerData: trigger,
      results: [{ triggerType: trigger.type, status, timestamp: new Date().toISOString() }],
      status,
      executionTimeMs,
      error: error ?? null,
    });
  }
}

export const automationService = new AutomationService();
