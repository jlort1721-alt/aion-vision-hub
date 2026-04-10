import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cameraDetections } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateDetectionInput, ListDetectionsFilter } from './schemas.js';

export class CameraDetectionService {
  async list(tenantId: string, filters: ListDetectionsFilter) {
    const conditions = [eq(cameraDetections.tenantId, tenantId)];

    if (filters.siteId) conditions.push(eq(cameraDetections.siteId, filters.siteId));
    if (filters.cameraId) conditions.push(eq(cameraDetections.cameraId, filters.cameraId));
    if (filters.type) conditions.push(eq(cameraDetections.type, filters.type));
    if (filters.dateFrom) conditions.push(gte(cameraDetections.ts, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(cameraDetections.ts, filters.dateTo));
    if (filters.minConfidence !== undefined) conditions.push(gte(cameraDetections.confidence, filters.minConfidence));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cameraDetections)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(cameraDetections)
      .where(whereClause)
      .orderBy(desc(cameraDetections.ts))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getById(id: string, tenantId: string) {
    const [row] = await db
      .select()
      .from(cameraDetections)
      .where(and(eq(cameraDetections.id, id), eq(cameraDetections.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new NotFoundError('CameraDetection', id);
    return row;
  }

  async create(data: CreateDetectionInput, tenantId: string) {
    const [row] = await db
      .insert(cameraDetections)
      .values({
        tenantId,
        siteId: data.siteId,
        cameraId: data.cameraId,
        ts: data.ts ?? new Date(),
        type: data.type,
        confidence: data.confidence,
        bboxJson: data.bboxJson,
        snapshotPath: data.snapshotPath,
        videoClipPath: data.videoClipPath,
        metadata: data.metadata,
      })
      .returning();
    return row;
  }

  async markReviewed(id: string, tenantId: string, userId: string, notes?: string) {
    const [row] = await db
      .update(cameraDetections)
      .set({
        reviewedBy: userId,
        reviewedAt: new Date(),
        notes: notes ?? null,
      })
      .where(and(eq(cameraDetections.id, id), eq(cameraDetections.tenantId, tenantId)))
      .returning();
    if (!row) throw new NotFoundError('CameraDetection', id);
    return row;
  }

  async getStats(tenantId: string, filters?: { siteId?: string; cameraId?: string; dateFrom?: Date; dateTo?: Date }) {
    const conditions = [eq(cameraDetections.tenantId, tenantId)];

    if (filters?.siteId) conditions.push(eq(cameraDetections.siteId, filters.siteId));
    if (filters?.cameraId) conditions.push(eq(cameraDetections.cameraId, filters.cameraId));
    if (filters?.dateFrom) conditions.push(gte(cameraDetections.ts, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(cameraDetections.ts, filters.dateTo));

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        type: cameraDetections.type,
        count: sql<number>`count(*)::int`,
        avgConfidence: sql<number>`avg(${cameraDetections.confidence})::real`,
      })
      .from(cameraDetections)
      .where(whereClause)
      .groupBy(cameraDetections.type);

    return rows;
  }
}

export const cameraDetectionService = new CameraDetectionService();
