import crypto from 'node:crypto';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { visitors, visitorPasses } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateVisitorInput,
  UpdateVisitorInput,
  VisitorFilters,
  CreateVisitorPassInput,
  VisitorPassFilters,
} from './schemas.js';

export class VisitorService {
  // ═══════════════════════════════════════════════════════════
  // VISITORS CRUD
  // ═══════════════════════════════════════════════════════════

  /**
   * List visitors with filters and pagination.
   */
  async list(tenantId: string, filters: VisitorFilters) {
    const conditions = [eq(visitors.tenantId, tenantId)];

    if (filters.siteId) {
      conditions.push(eq(visitors.siteId, filters.siteId));
    }
    if (filters.isBlacklisted !== undefined) {
      conditions.push(eq(visitors.isBlacklisted, filters.isBlacklisted));
    }
    if (filters.search) {
      conditions.push(
        sql`(${visitors.fullName} ILIKE ${'%' + filters.search + '%'} OR ${visitors.documentId} ILIKE ${'%' + filters.search + '%'} OR ${visitors.company} ILIKE ${'%' + filters.search + '%'})`,
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitors)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / filters.perPage);
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(visitors)
      .where(whereClause)
      .orderBy(desc(visitors.createdAt))
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
   * Get a single visitor by ID, scoped to tenant.
   */
  async getById(id: string, tenantId: string) {
    const [visitor] = await db
      .select()
      .from(visitors)
      .where(and(eq(visitors.id, id), eq(visitors.tenantId, tenantId)))
      .limit(1);

    if (!visitor) throw new NotFoundError('Visitor', id);
    return visitor;
  }

  /**
   * Create a new visitor.
   */
  async create(data: CreateVisitorInput, tenantId: string) {
    const [visitor] = await db
      .insert(visitors)
      .values({
        tenantId,
        fullName: data.fullName,
        siteId: data.siteId ?? null,
        documentId: data.documentId ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        company: data.company ?? null,
        visitReason: data.visitReason ?? 'other',
        hostName: data.hostName ?? null,
        hostUnit: data.hostUnit ?? null,
        hostPhone: data.hostPhone ?? null,
        notes: data.notes ?? null,
        isBlacklisted: false,
        visitCount: 0,
      })
      .returning();

    return visitor;
  }

  /**
   * Partially update a visitor.
   */
  async update(id: string, data: UpdateVisitorInput, tenantId: string) {
    const [visitor] = await db
      .update(visitors)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(visitors.id, id), eq(visitors.tenantId, tenantId)))
      .returning();

    if (!visitor) throw new NotFoundError('Visitor', id);
    return visitor;
  }

  /**
   * Delete a visitor.
   */
  async delete(id: string, tenantId: string) {
    const [visitor] = await db
      .delete(visitors)
      .where(and(eq(visitors.id, id), eq(visitors.tenantId, tenantId)))
      .returning();

    if (!visitor) throw new NotFoundError('Visitor', id);
    return visitor;
  }

  // ═══════════════════════════════════════════════════════════
  // VISITOR PASSES
  // ═══════════════════════════════════════════════════════════

  /**
   * List visitor passes with filters and pagination.
   */
  async listPasses(tenantId: string, filters: VisitorPassFilters) {
    const conditions = [eq(visitorPasses.tenantId, tenantId)];

    if (filters.visitorId) {
      conditions.push(eq(visitorPasses.visitorId, filters.visitorId));
    }
    if (filters.status) {
      conditions.push(eq(visitorPasses.status, filters.status));
    }
    if (filters.siteId) {
      conditions.push(eq(visitorPasses.siteId, filters.siteId));
    }
    if (filters.from) {
      conditions.push(gte(visitorPasses.validFrom, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(visitorPasses.validUntil, new Date(filters.to)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitorPasses)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / filters.perPage);
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select({
        id: visitorPasses.id,
        tenantId: visitorPasses.tenantId,
        visitorId: visitorPasses.visitorId,
        siteId: visitorPasses.siteId,
        qrToken: visitorPasses.qrToken,
        passType: visitorPasses.passType,
        validFrom: visitorPasses.validFrom,
        validUntil: visitorPasses.validUntil,
        status: visitorPasses.status,
        checkInAt: visitorPasses.checkInAt,
        checkOutAt: visitorPasses.checkOutAt,
        checkInBy: visitorPasses.checkInBy,
        authorizedBy: visitorPasses.authorizedBy,
        notes: visitorPasses.notes,
        metadata: visitorPasses.metadata,
        createdAt: visitorPasses.createdAt,
        // Enrichment: visitor name via LEFT JOIN
        visitorName: visitors.fullName,
        visitorCompany: visitors.company,
      })
      .from(visitorPasses)
      .leftJoin(visitors, eq(visitorPasses.visitorId, visitors.id))
      .where(whereClause)
      .orderBy(desc(visitorPasses.createdAt))
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
   * Create a visitor pass with an auto-generated QR token.
   */
  async createPass(data: CreateVisitorPassInput, tenantId: string, userId: string) {
    // Ensure the visitor exists and belongs to the tenant
    await this.getById(data.visitorId, tenantId);

    const qrToken = this.generateQRToken();

    const [pass] = await db
      .insert(visitorPasses)
      .values({
        tenantId,
        visitorId: data.visitorId,
        siteId: data.siteId ?? null,
        qrToken,
        passType: data.passType ?? 'single_use',
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        status: 'active',
        authorizedBy: userId,
        notes: data.notes ?? null,
      })
      .returning();

    return pass;
  }

  /**
   * Revoke a visitor pass.
   */
  async revokePass(passId: string, tenantId: string) {
    const [pass] = await db
      .update(visitorPasses)
      .set({ status: 'revoked' })
      .where(and(eq(visitorPasses.id, passId), eq(visitorPasses.tenantId, tenantId)))
      .returning();

    if (!pass) throw new NotFoundError('VisitorPass', passId);
    return pass;
  }

  // ═══════════════════════════════════════════════════════════
  // QR TOKEN
  // ═══════════════════════════════════════════════════════════

  /**
   * Generate a random 32-char hex token.
   */
  generateQRToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate a QR token: find the pass, check status and date range.
   */
  async validateQR(qrToken: string, tenantId: string) {
    const [pass] = await db
      .select()
      .from(visitorPasses)
      .where(
        and(
          eq(visitorPasses.qrToken, qrToken),
          eq(visitorPasses.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!pass) throw new NotFoundError('VisitorPass', qrToken);

    const now = new Date();
    const isActive = pass.status === 'active';
    const isWithinRange = pass.validFrom <= now && pass.validUntil >= now;
    const isValid = isActive && isWithinRange;

    const visitor = await this.getById(pass.visitorId, tenantId);

    return {
      valid: isValid,
      reason: !isActive
        ? `Pass status is '${pass.status}'`
        : !isWithinRange
          ? 'Pass is outside valid date range'
          : null,
      visitor,
      pass,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK-IN / CHECK-OUT
  // ═══════════════════════════════════════════════════════════

  /**
   * Check in a visitor: set checkInAt, checkInBy, increment visitCount, update lastVisitAt.
   */
  async checkInVisitor(passId: string, tenantId: string, userId: string) {
    const now = new Date();

    const [pass] = await db
      .update(visitorPasses)
      .set({
        checkInAt: now,
        checkInBy: userId,
      })
      .where(and(eq(visitorPasses.id, passId), eq(visitorPasses.tenantId, tenantId)))
      .returning();

    if (!pass) throw new NotFoundError('VisitorPass', passId);

    // Increment visitor visit count and update last visit timestamp
    await db
      .update(visitors)
      .set({
        visitCount: sql`${visitors.visitCount} + 1`,
        lastVisitAt: now,
        updatedAt: now,
      })
      .where(and(eq(visitors.id, pass.visitorId), eq(visitors.tenantId, tenantId)));

    return pass;
  }

  /**
   * Check out a visitor: set checkOutAt, mark pass as 'used' if single_use.
   */
  async checkOutVisitor(passId: string, tenantId: string) {
    const now = new Date();

    // First get the pass to check its type
    const [existing] = await db
      .select()
      .from(visitorPasses)
      .where(and(eq(visitorPasses.id, passId), eq(visitorPasses.tenantId, tenantId)))
      .limit(1);

    if (!existing) throw new NotFoundError('VisitorPass', passId);

    const updateData: Record<string, unknown> = {
      checkOutAt: now,
    };

    if (existing.passType === 'single_use') {
      updateData.status = 'used';
    }

    const [pass] = await db
      .update(visitorPasses)
      .set(updateData)
      .where(and(eq(visitorPasses.id, passId), eq(visitorPasses.tenantId, tenantId)))
      .returning();

    return pass;
  }

  // ═══════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════

  /**
   * Get visitor stats: total visitors, active passes, checked in today, blacklisted count.
   */
  async getVisitorStats(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [visitorCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitors)
      .where(eq(visitors.tenantId, tenantId));

    const [activePassCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitorPasses)
      .where(
        and(
          eq(visitorPasses.tenantId, tenantId),
          eq(visitorPasses.status, 'active'),
        ),
      );

    const [checkedInTodayCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitorPasses)
      .where(
        and(
          eq(visitorPasses.tenantId, tenantId),
          gte(visitorPasses.checkInAt, today),
        ),
      );

    const [blacklistedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitors)
      .where(
        and(
          eq(visitors.tenantId, tenantId),
          eq(visitors.isBlacklisted, true),
        ),
      );

    return {
      totalVisitors: visitorCount?.count ?? 0,
      activePasses: activePassCount?.count ?? 0,
      checkedInToday: checkedInTodayCount?.count ?? 0,
      blacklisted: blacklistedCount?.count ?? 0,
    };
  }
}

export const visitorService = new VisitorService();
