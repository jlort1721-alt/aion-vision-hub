import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  shifts,
  shiftAssignments,
  profiles,
} from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateShiftInput,
  UpdateShiftInput,
  ShiftFilters,
  CreateShiftAssignmentInput,
  UpdateShiftAssignmentInput,
  ShiftAssignmentFilters,
} from './schemas.js';

export class ShiftService {
  // ══════════════════════════════════════════════════════════
  // SHIFTS
  // ══════════════════════════════════════════════════════════

  async listShifts(tenantId: string, filters: ShiftFilters) {
    const conditions = [eq(shifts.tenantId, tenantId)];

    if (filters.siteId) {
      conditions.push(eq(shifts.siteId, filters.siteId));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(shifts.isActive, filters.isActive));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(shifts)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(shifts)
      .where(whereClause)
      .orderBy(desc(shifts.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getShiftById(id: string, tenantId: string) {
    const [shift] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
      .limit(1);
    if (!shift) throw new NotFoundError('Shift', id);
    return shift;
  }

  async createShift(data: CreateShiftInput, tenantId: string) {
    const [shift] = await db
      .insert(shifts)
      .values({
        tenantId,
        name: data.name,
        siteId: data.siteId ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        daysOfWeek: data.daysOfWeek,
        maxGuards: data.maxGuards,
        description: data.description ?? null,
        isActive: data.isActive,
      })
      .returning();
    return shift;
  }

  async updateShift(id: string, data: UpdateShiftInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.siteId !== undefined) updateData.siteId = data.siteId;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.daysOfWeek !== undefined) updateData.daysOfWeek = data.daysOfWeek;
    if (data.maxGuards !== undefined) updateData.maxGuards = data.maxGuards;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [shift] = await db
      .update(shifts)
      .set(updateData)
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
      .returning();

    if (!shift) throw new NotFoundError('Shift', id);
    return shift;
  }

  async deleteShift(id: string, tenantId: string) {
    const [shift] = await db
      .delete(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.tenantId, tenantId)))
      .returning();
    if (!shift) throw new NotFoundError('Shift', id);
    return shift;
  }

  // ══════════════════════════════════════════════════════════
  // SHIFT ASSIGNMENTS
  // ══════════════════════════════════════════════════════════

  async listAssignments(tenantId: string, filters: ShiftAssignmentFilters) {
    const conditions = [eq(shiftAssignments.tenantId, tenantId)];

    if (filters.shiftId) conditions.push(eq(shiftAssignments.shiftId, filters.shiftId));
    if (filters.userId) conditions.push(eq(shiftAssignments.userId, filters.userId));
    if (filters.status) conditions.push(eq(shiftAssignments.status, filters.status));
    if (filters.from) conditions.push(gte(shiftAssignments.date, new Date(filters.from)));
    if (filters.to) conditions.push(lte(shiftAssignments.date, new Date(filters.to)));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(shiftAssignments)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select({
        id: shiftAssignments.id,
        tenantId: shiftAssignments.tenantId,
        shiftId: shiftAssignments.shiftId,
        userId: shiftAssignments.userId,
        date: shiftAssignments.date,
        status: shiftAssignments.status,
        checkInAt: shiftAssignments.checkInAt,
        checkOutAt: shiftAssignments.checkOutAt,
        checkInLocation: shiftAssignments.checkInLocation,
        notes: shiftAssignments.notes,
        createdAt: shiftAssignments.createdAt,
        updatedAt: shiftAssignments.updatedAt,
        // Enrichment: user and shift names via LEFT JOIN
        userName: profiles.fullName,
        userEmail: profiles.email,
        shiftName: shifts.name,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
      })
      .from(shiftAssignments)
      .leftJoin(profiles, eq(shiftAssignments.userId, profiles.id))
      .leftJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
      .where(whereClause)
      .orderBy(desc(shiftAssignments.date))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async createAssignment(data: CreateShiftAssignmentInput, tenantId: string) {
    const [assignment] = await db
      .insert(shiftAssignments)
      .values({
        tenantId,
        shiftId: data.shiftId,
        userId: data.userId,
        date: new Date(data.date),
        status: data.status,
        notes: data.notes ?? null,
      })
      .returning();
    return assignment;
  }

  async updateAssignment(id: string, data: UpdateShiftAssignmentInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.status !== undefined) updateData.status = data.status;
    if (data.checkInAt !== undefined) updateData.checkInAt = new Date(data.checkInAt);
    if (data.checkOutAt !== undefined) updateData.checkOutAt = new Date(data.checkOutAt);
    if (data.checkInLocation !== undefined) updateData.checkInLocation = data.checkInLocation;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [assignment] = await db
      .update(shiftAssignments)
      .set(updateData)
      .where(and(eq(shiftAssignments.id, id), eq(shiftAssignments.tenantId, tenantId)))
      .returning();

    if (!assignment) throw new NotFoundError('ShiftAssignment', id);
    return assignment;
  }

  // ══════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════

  async getAssignmentStats(tenantId: string) {
    const [result] = await db
      .select({
        total: sql<number>`count(*)::int`,
        scheduled: sql<number>`count(*) filter (where ${shiftAssignments.status} = 'scheduled')::int`,
        checked_in: sql<number>`count(*) filter (where ${shiftAssignments.status} = 'checked_in')::int`,
        checked_out: sql<number>`count(*) filter (where ${shiftAssignments.status} = 'checked_out')::int`,
        missed: sql<number>`count(*) filter (where ${shiftAssignments.status} = 'missed')::int`,
        excused: sql<number>`count(*) filter (where ${shiftAssignments.status} = 'excused')::int`,
      })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.tenantId, tenantId));

    return {
      total: result?.total ?? 0,
      byStatus: {
        scheduled: result?.scheduled ?? 0,
        checked_in: result?.checked_in ?? 0,
        checked_out: result?.checked_out ?? 0,
        missed: result?.missed ?? 0,
        excused: result?.excused ?? 0,
      },
    };
  }
  async generateShiftReport(tenantId: string, shiftId: string) {
    const [shift] = await db.select().from(shifts).where(and(eq(shifts.id, shiftId), eq(shifts.tenantId, tenantId))).limit(1);
    if (!shift) return null;

    const now = new Date();
    const shiftStart = new Date(now.toDateString() + ' ' + shift.startTime);
    const shiftEnd = new Date(now.toDateString() + ' ' + shift.endTime);
    if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

    const [eventStats] = await db.execute(sql`
      SELECT count(*)::int as total_events,
             count(*) FILTER (WHERE severity = 'critical')::int as critical_events,
             count(*) FILTER (WHERE severity = 'high')::int as high_events
      FROM events WHERE tenant_id = ${tenantId} AND created_at BETWEEN ${shiftStart.toISOString()} AND ${shiftEnd.toISOString()}
    `);

    const [incidentStats] = await db.execute(sql`
      SELECT count(*)::int as total_incidents,
             count(*) FILTER (WHERE status = 'resolved')::int as resolved
      FROM incidents WHERE tenant_id = ${tenantId} AND created_at BETWEEN ${shiftStart.toISOString()} AND ${shiftEnd.toISOString()}
    `);

    return {
      shift: { id: shift.id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime },
      period: { start: shiftStart.toISOString(), end: shiftEnd.toISOString() },
      events: eventStats ?? { total_events: 0, critical_events: 0, high_events: 0 },
      incidents: incidentStats ?? { total_incidents: 0, resolved: 0 },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const shiftService = new ShiftService();
