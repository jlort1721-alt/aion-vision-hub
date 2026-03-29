/**
 * MCP Server Tool — Operations (Shifts, Patrols, SLA)
 *
 * Provides tools for querying current shift, patrol compliance,
 * and SLA compliance metrics. All queries are tenant-scoped.
 */

import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { shifts, shiftAssignments, patrolLogs, slaDefinitions } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── get_current_shift ──────────────────────────────────────────

export const getCurrentShift: MCPServerTool = {
  name: 'get_current_shift',
  description:
    'Get the current active shift and who is on duty. Returns shift info and any assignments for today.',
  parameters: {},
  execute: async (_params, context) => {
    // Get all active shifts for the tenant
    const activeShifts = await db
      .select({
        id: shifts.id,
        name: shifts.name,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        maxGuards: shifts.maxGuards,
        description: shifts.description,
        siteId: shifts.siteId,
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.tenantId, context.tenantId),
          eq(shifts.isActive, true),
        ),
      );

    // Get today's assignments
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayAssignments = await db
      .select({
        id: shiftAssignments.id,
        shiftId: shiftAssignments.shiftId,
        userId: shiftAssignments.userId,
        status: shiftAssignments.status,
        checkInAt: shiftAssignments.checkInAt,
        checkOutAt: shiftAssignments.checkOutAt,
        notes: shiftAssignments.notes,
      })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.tenantId, context.tenantId),
          gte(shiftAssignments.date, todayStart),
          lte(shiftAssignments.date, todayEnd),
        ),
      );

    // Combine shifts with their assignments
    const shiftsWithAssignments = activeShifts.map(shift => ({
      ...shift,
      assignments: todayAssignments.filter(a => a.shiftId === shift.id),
    }));

    return {
      shifts: shiftsWithAssignments,
      total_shifts: activeShifts.length,
      total_assignments_today: todayAssignments.length,
      date: todayStart.toISOString().slice(0, 10),
    };
  },
};

// ── get_patrol_compliance ──────────────────────────────────────

export const getPatrolCompliance: MCPServerTool = {
  name: 'get_patrol_compliance',
  description:
    'Get patrol compliance stats for a given date: completion rate, missed checkpoints, and status breakdown.',
  parameters: {
    date: {
      type: 'string',
      description: 'Date in YYYY-MM-DD format (default: today)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const dateStr = (params.date as string) || new Date().toISOString().slice(0, 10);
    const dateStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dateEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${patrolLogs.status} = 'completed')::int`,
        missed: sql<number>`count(*) filter (where ${patrolLogs.status} = 'missed')::int`,
        skipped: sql<number>`count(*) filter (where ${patrolLogs.status} = 'skipped')::int`,
        incident: sql<number>`count(*) filter (where ${patrolLogs.status} = 'incident')::int`,
      })
      .from(patrolLogs)
      .where(
        and(
          eq(patrolLogs.tenantId, context.tenantId),
          gte(patrolLogs.createdAt, dateStart),
          lte(patrolLogs.createdAt, dateEnd),
        ),
      );

    const total = stats?.total ?? 0;
    const completed = stats?.completed ?? 0;
    const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      date: dateStr,
      total_checkpoints: total,
      completed,
      missed: stats?.missed ?? 0,
      skipped: stats?.skipped ?? 0,
      incident: stats?.incident ?? 0,
      compliance_rate_percent: complianceRate,
    };
  },
};

// ── get_sla_compliance ─────────────────────────────────────────

export const getSlaCompliance: MCPServerTool = {
  name: 'get_sla_compliance',
  description:
    'Get current SLA compliance metrics: active SLA definitions with response and resolution times.',
  parameters: {},
  execute: async (_params, context) => {
    const definitions = await db
      .select({
        id: slaDefinitions.id,
        name: slaDefinitions.name,
        description: slaDefinitions.description,
        severity: slaDefinitions.severity,
        responseTimeMinutes: slaDefinitions.responseTimeMinutes,
        resolutionTimeMinutes: slaDefinitions.resolutionTimeMinutes,
        businessHoursOnly: slaDefinitions.businessHoursOnly,
        isActive: slaDefinitions.isActive,
      })
      .from(slaDefinitions)
      .where(
        and(
          eq(slaDefinitions.tenantId, context.tenantId),
          eq(slaDefinitions.isActive, true),
        ),
      );

    return {
      sla_definitions: definitions,
      total: definitions.length,
    };
  },
};

/** All operations tools */
export const operationsTools: MCPServerTool[] = [
  getCurrentShift,
  getPatrolCompliance,
  getSlaCompliance,
];
