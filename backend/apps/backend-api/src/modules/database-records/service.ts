import { eq, and, ilike } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { databaseRecords } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateRecordInput, UpdateRecordInput, RecordFilters } from './schemas.js';

class DatabaseRecordService {
  async list(tenantId: string, filters?: RecordFilters) {
    const conditions = [eq(databaseRecords.tenantId, tenantId)];
    if (filters?.sectionId) conditions.push(eq(databaseRecords.sectionId, filters.sectionId));
    if (filters?.category) conditions.push(eq(databaseRecords.category, filters.category));
    if (filters?.status) conditions.push(eq(databaseRecords.status, filters.status));
    if (filters?.search) conditions.push(ilike(databaseRecords.title, `%${filters.search}%`));
    return db.select().from(databaseRecords).where(and(...conditions))
      .orderBy(databaseRecords.updatedAt).limit(500);
  }

  async getById(id: string, tenantId: string) {
    const [item] = await db.select().from(databaseRecords)
      .where(and(eq(databaseRecords.id, id), eq(databaseRecords.tenantId, tenantId))).limit(1);
    if (!item) throw new NotFoundError('Record', id);
    return item;
  }

  async create(data: CreateRecordInput, createdBy: string, tenantId: string) {
    const [record] = await db.insert(databaseRecords)
      .values({ tenantId, createdBy, ...data }).returning();
    return record;
  }

  async update(id: string, data: UpdateRecordInput, tenantId: string) {
    const [record] = await db.update(databaseRecords).set({ ...data, updatedAt: new Date() })
      .where(and(eq(databaseRecords.id, id), eq(databaseRecords.tenantId, tenantId))).returning();
    if (!record) throw new NotFoundError('Record', id);
    return record;
  }

  async delete(id: string, tenantId: string) {
    const [record] = await db.delete(databaseRecords)
      .where(and(eq(databaseRecords.id, id), eq(databaseRecords.tenantId, tenantId))).returning();
    if (!record) throw new NotFoundError('Record', id);
  }
}

export const databaseRecordService = new DatabaseRecordService();
