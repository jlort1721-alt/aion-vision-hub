/**
 * AION Rules Engine — Condition evaluation and automation rule matching.
 *
 * Loads rules from the PostgreSQL `automation_rules` table, caches them
 * in memory, and provides evaluation against incoming events.
 *
 * Supports:
 *   - Structured conditions with dot-notation field extraction
 *   - Operators: eq, neq, gt, lt, in, contains, exists
 *   - Schedule checking with timezone (America/Bogota)
 *   - Exception conditions to skip rules
 *   - Cooldown enforcement
 *   - Execution recording and CRUD
 */

import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { AionEvent } from './event-bus.js';

const logger = createLogger({ name: 'rules-engine' });

// ── Types ───────────────────────────────────────────────────────────────────

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in' | 'contains' | 'exists';
  value?: unknown;
}

export interface RuleSchedule {
  days?: number[]; // 0=Sunday..6=Saturday
  start?: string;  // HH:MM
  end?: string;    // HH:MM
  timezone?: string;
}

export interface RuleAction {
  type: string;
  config?: Record<string, unknown>;
  fallback?: RuleAction;
}

export interface AutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger: {
    type: string;
    config?: Record<string, unknown>;
  };
  conditions: RuleCondition[];
  actions: RuleAction[];
  exceptions?: RuleCondition[];
  schedule?: RuleSchedule;
  priority: number;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  trigger_count: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExecutionRecord {
  rule_id: string;
  status: 'success' | 'partial' | 'failed';
  execution_time_ms: number;
  trigger_data: Record<string, unknown>;
  results: Array<{ action: string; status: string; detail?: string }>;
  error?: string;
}

export interface RuleCreateInput {
  tenant_id: string;
  name: string;
  description?: string;
  trigger: { type: string; config?: Record<string, unknown> };
  conditions?: RuleCondition[];
  actions: RuleAction[];
  exceptions?: RuleCondition[];
  schedule?: RuleSchedule;
  priority?: number;
  cooldown_minutes?: number;
  is_active?: boolean;
  created_by: string;
}

export interface RuleUpdateInput {
  name?: string;
  description?: string;
  trigger?: { type: string; config?: Record<string, unknown> };
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  exceptions?: RuleCondition[];
  schedule?: RuleSchedule;
  priority?: number;
  cooldown_minutes?: number;
  is_active?: boolean;
}

export interface RuleHistoryOptions {
  rule_id?: string;
  tenant_id?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a value from a nested object using dot notation.
 * e.g. 'data.temperature' on { data: { temperature: 42 } } returns 42
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Get the current time in a specific timezone using Intl.DateTimeFormat.
 */
function getTimeInTimezone(timezone: string): { dayOfWeek: number; hours: number; minutes: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    dayOfWeek: dayMap[weekdayStr] ?? 0,
    hours: hour,
    minutes: minute,
  };
}

/**
 * Parse a HH:MM time string into total minutes since midnight.
 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// ── Rules Engine Class ──────────────────────────────────────────────────────

class RulesEngine {
  private cachedRules: AutomationRule[] = [];
  private lastCacheLoad = 0;
  private cacheIntervalMs = 60_000; // reload every 60s
  private reloadTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start the periodic cache reload
    this.reloadTimer = setInterval(() => {
      this.loadRules().catch((err) => {
        logger.error({ err }, 'Periodic rule cache reload failed');
      });
    }, this.cacheIntervalMs);
  }

  // ── Evaluate ────────────────────────────────────────────────────────────

  /**
   * Evaluate an event against all cached active rules.
   * Returns all rules that match the event (trigger type, conditions, schedule, no exceptions).
   */
  async evaluate(event: AionEvent): Promise<AutomationRule[]> {
    await this.ensureCacheLoaded();

    const matchingRules: AutomationRule[] = [];

    for (const rule of this.cachedRules) {
      try {
        if (!rule.is_active) continue;

        // 1. Check trigger type matches event type
        if (!this.matchesTrigger(rule, event)) continue;

        // 2. Check cooldown
        if (this.isInCooldown(rule)) continue;

        // 3. Check schedule
        if (!this.matchesSchedule(rule)) continue;

        // 4. Check exception conditions — if any exception matches, skip
        if (this.matchesExceptions(rule, event)) continue;

        // 5. Check all conditions
        if (!this.matchesConditions(rule.conditions, event)) continue;

        matchingRules.push(rule);
      } catch (err) {
        logger.error({ err, ruleId: rule.id, ruleName: rule.name }, 'Error evaluating rule');
      }
    }

    // Sort by priority descending (highest priority first)
    matchingRules.sort((a, b) => b.priority - a.priority);

    if (matchingRules.length > 0) {
      logger.info(
        { eventType: event.type, matchCount: matchingRules.length, ruleIds: matchingRules.map((r) => r.id) },
        'Rules matched for event',
      );
    }

    return matchingRules;
  }

  // ── Condition Evaluation ────────────────────────────────────────────────

  private matchesTrigger(rule: AutomationRule, event: AionEvent): boolean {
    const triggerType = rule.trigger?.type;
    if (!triggerType) return false;

    // Support wildcard triggers
    if (triggerType === '*') return true;

    // Support pattern matching (e.g., 'access.*')
    if (triggerType.includes('*')) {
      const regex = new RegExp('^' + triggerType.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return regex.test(event.type);
    }

    // Exact match
    return triggerType === event.type;
  }

  private isInCooldown(rule: AutomationRule): boolean {
    if (!rule.last_triggered_at || rule.cooldown_minutes <= 0) return false;

    const lastTriggered = new Date(rule.last_triggered_at).getTime();
    const cooldownMs = rule.cooldown_minutes * 60 * 1000;
    const elapsed = Date.now() - lastTriggered;

    if (elapsed < cooldownMs) {
      logger.debug(
        { ruleId: rule.id, cooldownRemaining: cooldownMs - elapsed },
        'Rule in cooldown',
      );
      return true;
    }

    return false;
  }

  private matchesSchedule(rule: AutomationRule): boolean {
    const schedule = rule.schedule;
    if (!schedule) return true; // no schedule = always active

    const tz = schedule.timezone ?? 'America/Bogota';
    const { dayOfWeek, hours, minutes } = getTimeInTimezone(tz);

    // Check day of week
    if (schedule.days && schedule.days.length > 0) {
      if (!schedule.days.includes(dayOfWeek)) return false;
    }

    // Check time range
    if (schedule.start && schedule.end) {
      const currentMinutes = hours * 60 + minutes;
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);

      if (startMinutes <= endMinutes) {
        // Normal range (e.g. 08:00 - 18:00)
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) return false;
      } else {
        // Overnight range (e.g. 22:00 - 06:00)
        if (currentMinutes < startMinutes && currentMinutes > endMinutes) return false;
      }
    }

    return true;
  }

  private matchesExceptions(rule: AutomationRule, event: AionEvent): boolean {
    const exceptions = rule.exceptions;
    if (!exceptions || exceptions.length === 0) return false;

    // If ANY exception condition matches, the rule should be skipped
    return this.matchesConditions(exceptions, event);
  }

  /**
   * Evaluate a list of conditions against an event. ALL conditions must match (AND logic).
   */
  private matchesConditions(conditions: RuleCondition[], event: AionEvent): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, event)) return false;
    }

    return true;
  }

  /**
   * Evaluate a single condition against an event.
   * Supports dot-notation field extraction from the event and event.data.
   */
  private evaluateCondition(condition: RuleCondition, event: AionEvent): boolean {
    const { field, operator, value } = condition;

    // Try to resolve the field from the event object first, then from event.data
    let actual = getNestedValue(event as unknown as Record<string, unknown>, field);
    if (actual === undefined) {
      actual = getNestedValue(event.data, field);
    }

    switch (operator) {
      case 'eq':
        return actual === value;

      case 'neq':
        return actual !== value;

      case 'gt':
        return typeof actual === 'number' && typeof value === 'number' && actual > value;

      case 'lt':
        return typeof actual === 'number' && typeof value === 'number' && actual < value;

      case 'in':
        return Array.isArray(value) && value.includes(actual);

      case 'contains':
        if (typeof actual === 'string' && typeof value === 'string') {
          return actual.includes(value);
        }
        if (Array.isArray(actual)) {
          return actual.includes(value);
        }
        return false;

      case 'exists':
        return actual !== undefined && actual !== null;

      default:
        logger.warn({ operator, field }, 'Unknown condition operator');
        return false;
    }
  }

  // ── Cache Management ────────────────────────────────────────────────────

  private async ensureCacheLoaded(): Promise<void> {
    if (this.cachedRules.length === 0 || Date.now() - this.lastCacheLoad > this.cacheIntervalMs) {
      await this.loadRules();
    }
  }

  async loadRules(): Promise<void> {
    try {
      const rows = await db.execute(sql`
        SELECT
          id, tenant_id, name, description, trigger, conditions, actions,
          priority, cooldown_minutes, last_triggered_at, trigger_count,
          is_active, created_by, created_at, updated_at
        FROM automation_rules
        WHERE is_active = true
        ORDER BY priority DESC
      `);

      const rawRows = rows as unknown as Array<Record<string, unknown>>;

      this.cachedRules = rawRows.map((row) => ({
        id: row.id as string,
        tenant_id: row.tenant_id as string,
        name: row.name as string,
        description: (row.description as string) ?? null,
        trigger: typeof row.trigger === 'string' ? JSON.parse(row.trigger) : (row.trigger as AutomationRule['trigger']),
        conditions: this.parseJsonField<RuleCondition[]>(row.conditions, []),
        actions: this.parseJsonField<RuleAction[]>(row.actions, []),
        exceptions: this.parseJsonField<RuleCondition[]>(row.exceptions, []),
        schedule: this.parseJsonField<RuleSchedule | undefined>(row.schedule, undefined),
        priority: (row.priority as number) ?? 1,
        cooldown_minutes: (row.cooldown_minutes as number) ?? 5,
        last_triggered_at: row.last_triggered_at ? String(row.last_triggered_at) : null,
        trigger_count: (row.trigger_count as number) ?? 0,
        is_active: (row.is_active as boolean) ?? true,
        created_by: row.created_by as string,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      }));

      this.lastCacheLoad = Date.now();
      logger.debug({ ruleCount: this.cachedRules.length }, 'Rules cache reloaded');
    } catch (err) {
      logger.error({ err }, 'Failed to load automation rules from database');
      // Keep the existing cache if the reload fails
    }
  }

  private parseJsonField<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return value as T;
  }

  // ── Execution Recording ─────────────────────────────────────────────────

  /**
   * Record a rule execution and update the rule's stats.
   */
  async recordExecution(
    ruleId: string,
    result: ExecutionRecord,
    error?: string,
  ): Promise<void> {
    try {
      // Insert execution record
      await db.execute(sql`
        INSERT INTO automation_executions (id, tenant_id, rule_id, trigger_data, results, status, execution_time_ms, error, created_at)
        SELECT
          ${crypto.randomUUID()},
          tenant_id,
          ${ruleId},
          ${JSON.stringify(result.trigger_data)}::jsonb,
          ${JSON.stringify(result.results)}::jsonb,
          ${result.status},
          ${result.execution_time_ms},
          ${error ?? null},
          NOW()
        FROM automation_rules
        WHERE id = ${ruleId}
      `);

      // Update rule stats
      await db.execute(sql`
        UPDATE automation_rules
        SET
          last_triggered_at = NOW(),
          trigger_count = trigger_count + 1,
          updated_at = NOW()
        WHERE id = ${ruleId}
      `);

      // Update the cached rule's last_triggered_at to enforce cooldown immediately
      const cached = this.cachedRules.find((r) => r.id === ruleId);
      if (cached) {
        cached.last_triggered_at = new Date().toISOString();
        cached.trigger_count += 1;
      }
    } catch (err) {
      logger.error({ err, ruleId }, 'Failed to record rule execution');
    }
  }

  // ── CRUD Methods ────────────────────────────────────────────────────────

  async list(tenantId: string, options: { isActive?: boolean; limit?: number; offset?: number } = {}): Promise<{
    rules: AutomationRule[];
    total: number;
  }> {
    try {
      const activeFilter = options.isActive !== undefined
        ? sql` AND is_active = ${options.isActive}`
        : sql``;

      const countResult = await db.execute(sql`
        SELECT count(*)::int AS total
        FROM automation_rules
        WHERE tenant_id = ${tenantId} ${activeFilter}
      `);
      const total = (countResult as unknown as Array<{ total: number }>)[0]?.total ?? 0;

      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const rows = await db.execute(sql`
        SELECT *
        FROM automation_rules
        WHERE tenant_id = ${tenantId} ${activeFilter}
        ORDER BY priority DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const rules = (rows as unknown as AutomationRule[]).map((row) => this.mapRowToRule(row));

      return { rules, total };
    } catch (err) {
      logger.error({ err, tenantId }, 'Failed to list rules');
      return { rules: [], total: 0 };
    }
  }

  async getById(id: string): Promise<AutomationRule | null> {
    try {
      const rows = await db.execute(sql`
        SELECT * FROM automation_rules WHERE id = ${id} LIMIT 1
      `);
      const rawRows = rows as unknown as Array<Record<string, unknown>>;
      if (rawRows.length === 0) return null;
      return this.mapRowToRule(rawRows[0] as unknown as AutomationRule);
    } catch (err) {
      logger.error({ err, ruleId: id }, 'Failed to get rule by ID');
      return null;
    }
  }

  async create(input: RuleCreateInput): Promise<AutomationRule | null> {
    try {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO automation_rules (
          id, tenant_id, name, description, trigger, conditions, actions,
          priority, cooldown_minutes, is_active, created_by, created_at, updated_at
        ) VALUES (
          ${id},
          ${input.tenant_id},
          ${input.name},
          ${input.description ?? null},
          ${JSON.stringify(input.trigger)}::jsonb,
          ${JSON.stringify(input.conditions ?? [])}::jsonb,
          ${JSON.stringify(input.actions)}::jsonb,
          ${input.priority ?? 1},
          ${input.cooldown_minutes ?? 5},
          ${input.is_active ?? true},
          ${input.created_by},
          NOW(),
          NOW()
        )
      `);

      // Reload cache to pick up the new rule
      await this.loadRules();

      return this.getById(id);
    } catch (err) {
      logger.error({ err }, 'Failed to create rule');
      return null;
    }
  }

  async update(id: string, input: RuleUpdateInput): Promise<AutomationRule | null> {
    try {
      const setClauses: string[] = ['updated_at = NOW()'];

      if (input.name !== undefined) setClauses.push(`name = '${input.name.replace(/'/g, "''")}'`);
      if (input.description !== undefined) setClauses.push(`description = '${(input.description ?? '').replace(/'/g, "''")}'`);
      if (input.trigger !== undefined) setClauses.push(`trigger = '${JSON.stringify(input.trigger)}'::jsonb`);
      if (input.conditions !== undefined) setClauses.push(`conditions = '${JSON.stringify(input.conditions)}'::jsonb`);
      if (input.actions !== undefined) setClauses.push(`actions = '${JSON.stringify(input.actions)}'::jsonb`);
      if (input.priority !== undefined) setClauses.push(`priority = ${input.priority}`);
      if (input.cooldown_minutes !== undefined) setClauses.push(`cooldown_minutes = ${input.cooldown_minutes}`);
      if (input.is_active !== undefined) setClauses.push(`is_active = ${input.is_active}`);

      await db.execute(sql.raw(`
        UPDATE automation_rules
        SET ${setClauses.join(', ')}
        WHERE id = '${id}'
      `));

      // Reload cache to pick up changes
      await this.loadRules();

      return this.getById(id);
    } catch (err) {
      logger.error({ err, ruleId: id }, 'Failed to update rule');
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await db.execute(sql`DELETE FROM automation_rules WHERE id = ${id}`);

      // Remove from cache
      this.cachedRules = this.cachedRules.filter((r) => r.id !== id);

      return true;
    } catch (err) {
      logger.error({ err, ruleId: id }, 'Failed to delete rule');
      return false;
    }
  }

  async getHistory(options: RuleHistoryOptions = {}): Promise<{
    executions: Array<Record<string, unknown>>;
    total: number;
  }> {
    try {
      const conditions: string[] = ['1=1'];

      if (options.rule_id) conditions.push(`rule_id = '${options.rule_id}'`);
      if (options.tenant_id) conditions.push(`tenant_id = '${options.tenant_id}'`);
      if (options.status) conditions.push(`status = '${options.status}'`);
      if (options.from) conditions.push(`created_at >= '${options.from}'`);
      if (options.to) conditions.push(`created_at <= '${options.to}'`);

      const where = conditions.join(' AND ');
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const countResult = await db.execute(sql.raw(
        `SELECT count(*)::int AS total FROM automation_executions WHERE ${where}`,
      ));
      const total = (countResult as unknown as Array<{ total: number }>)[0]?.total ?? 0;

      const rows = await db.execute(sql.raw(
        `SELECT * FROM automation_executions WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      ));

      return {
        executions: rows as unknown as Array<Record<string, unknown>>,
        total,
      };
    } catch (err) {
      logger.error({ err }, 'Failed to get rule execution history');
      return { executions: [], total: 0 };
    }
  }

  // ── Shutdown ────────────────────────────────────────────────────────────

  shutdown(): void {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }
    this.cachedRules = [];
    logger.info('Rules engine shut down');
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private mapRowToRule(row: AutomationRule | Record<string, unknown>): AutomationRule {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      name: r.name as string,
      description: (r.description as string) ?? null,
      trigger: typeof r.trigger === 'string' ? JSON.parse(r.trigger) : (r.trigger as AutomationRule['trigger']),
      conditions: this.parseJsonField<RuleCondition[]>(r.conditions, []),
      actions: this.parseJsonField<RuleAction[]>(r.actions, []),
      exceptions: this.parseJsonField<RuleCondition[]>(r.exceptions, []),
      schedule: this.parseJsonField<RuleSchedule | undefined>(r.schedule, undefined),
      priority: (r.priority as number) ?? 1,
      cooldown_minutes: (r.cooldown_minutes as number) ?? 5,
      last_triggered_at: r.last_triggered_at ? String(r.last_triggered_at) : null,
      trigger_count: (r.trigger_count as number) ?? 0,
      is_active: (r.is_active as boolean) ?? true,
      created_by: r.created_by as string,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const rulesEngine = new RulesEngine();
