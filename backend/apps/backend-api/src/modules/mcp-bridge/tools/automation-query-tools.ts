/**
 * MCP Server Tool — Automation Rules & Executions
 *
 * Provides tools for querying automation rules, toggling their
 * active state, and reviewing recent execution history.
 * All operations are tenant-scoped.
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { automationRules, automationExecutions } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── query_automation_rules ───────────────────────────────────

export const queryAutomationRules: MCPServerTool = {
  name: 'query_automation_rules',
  description:
    'List automation rules with optional active/inactive filter. Returns rule details including trigger config, conditions, and execution stats.',
  parameters: {
    is_active: {
      type: 'string',
      description: 'Filter by active status',
      required: false,
      enum: ['true', 'false'],
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 50, max: 200)',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);

      const conditions = [eq(automationRules.tenantId, context.tenantId)];
      if (params.is_active !== undefined && params.is_active !== null) {
        const isActive = params.is_active === 'true';
        conditions.push(eq(automationRules.isActive, isActive));
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(automationRules)
        .where(and(...conditions));

      const rows = await db
        .select({
          id: automationRules.id,
          name: automationRules.name,
          description: automationRules.description,
          trigger: automationRules.trigger,
          conditions: automationRules.conditions,
          actions: automationRules.actions,
          priority: automationRules.priority,
          cooldownMinutes: automationRules.cooldownMinutes,
          isActive: automationRules.isActive,
          triggerCount: automationRules.triggerCount,
          lastTriggeredAt: automationRules.lastTriggeredAt,
          createdAt: automationRules.createdAt,
          updatedAt: automationRules.updatedAt,
        })
        .from(automationRules)
        .where(and(...conditions))
        .orderBy(desc(automationRules.updatedAt))
        .limit(limit);

      return {
        rules: rows,
        total: countResult?.count ?? 0,
        returned: rows.length,
        limit,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to query automation rules' };
    }
  },
};

// ── toggle_automation_rule ───────────────────────────────────

export const toggleAutomationRule: MCPServerTool = {
  name: 'toggle_automation_rule',
  description:
    'Enable or disable a specific automation rule by setting its active status.',
  parameters: {
    rule_id: {
      type: 'string',
      description: 'Automation rule UUID to toggle (required)',
      required: true,
    },
    is_active: {
      type: 'string',
      description: 'Set active status: "true" to enable, "false" to disable (required)',
      required: true,
      enum: ['true', 'false'],
    },
  },
  execute: async (params, context) => {
    try {
      const ruleId = params.rule_id as string;
      const isActive = params.is_active === 'true';

      if (!ruleId) {
        return { error: 'rule_id is required' };
      }

      // Verify rule belongs to tenant
      const [existing] = await db
        .select({
          id: automationRules.id,
          name: automationRules.name,
          isActive: automationRules.isActive,
        })
        .from(automationRules)
        .where(
          and(
            eq(automationRules.id, ruleId),
            eq(automationRules.tenantId, context.tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        return { error: `Automation rule '${ruleId}' not found or does not belong to this tenant` };
      }

      if (existing.isActive === isActive) {
        return {
          message: `Rule '${existing.name}' is already ${isActive ? 'active' : 'inactive'}`,
          rule_id: ruleId,
          name: existing.name,
          is_active: isActive,
          changed: false,
        };
      }

      const [updated] = await db
        .update(automationRules)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(automationRules.id, ruleId))
        .returning({
          id: automationRules.id,
          name: automationRules.name,
          isActive: automationRules.isActive,
        });

      return {
        message: `Rule '${updated.name}' ${isActive ? 'enabled' : 'disabled'} successfully`,
        rule_id: updated.id,
        name: updated.name,
        is_active: updated.isActive,
        changed: true,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to toggle automation rule' };
    }
  },
};

// ── query_automation_executions ──────────────────────────────

export const queryAutomationExecutions: MCPServerTool = {
  name: 'query_automation_executions',
  description:
    'Get recent automation rule execution history with status and results. Optionally filter by rule ID or execution status.',
  parameters: {
    rule_id: {
      type: 'string',
      description: 'Filter by specific automation rule UUID',
      required: false,
    },
    status: {
      type: 'string',
      description: 'Filter by execution status',
      required: false,
      enum: ['success', 'partial', 'failed'],
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 50, max: 200)',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);

      const conditions = [eq(automationExecutions.tenantId, context.tenantId)];
      if (params.rule_id) {
        conditions.push(eq(automationExecutions.ruleId, params.rule_id as string));
      }
      if (params.status) {
        conditions.push(eq(automationExecutions.status, params.status as string));
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(automationExecutions)
        .where(and(...conditions));

      const rows = await db
        .select({
          id: automationExecutions.id,
          ruleId: automationExecutions.ruleId,
          ruleName: automationRules.name,
          triggerData: automationExecutions.triggerData,
          results: automationExecutions.results,
          status: automationExecutions.status,
          executionTimeMs: automationExecutions.executionTimeMs,
          error: automationExecutions.error,
          createdAt: automationExecutions.createdAt,
        })
        .from(automationExecutions)
        .leftJoin(automationRules, eq(automationExecutions.ruleId, automationRules.id))
        .where(and(...conditions))
        .orderBy(desc(automationExecutions.createdAt))
        .limit(limit);

      return {
        executions: rows,
        total: countResult?.count ?? 0,
        returned: rows.length,
        limit,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to query automation executions' };
    }
  },
};

/** All automation query tools */
export const automationQueryTools: MCPServerTool[] = [
  queryAutomationRules,
  toggleAutomationRule,
  queryAutomationExecutions,
];
