import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { keyInventory, keyLogs } from '../../db/schema/index.js';
import type { KeyFilters, KeyLogFilters } from './schemas.js';

export class KeyService {
  async createKey(tenantId: string, data: Record<string, any>) {
    const [result] = await db.insert(keyInventory).values({ ...data, tenantId } as any).returning();
    return result;
  }

  async listKeys(tenantId: string, filters: KeyFilters) {
    const conditions: any[] = [eq(keyInventory.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(keyInventory.status, filters.status));
    if (filters.siteId) conditions.push(eq(keyInventory.siteId, filters.siteId));
    if (filters.keyType) conditions.push(eq(keyInventory.keyType, filters.keyType));

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(keyInventory).where(whereClause);
    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db.select().from(keyInventory).where(whereClause).orderBy(desc(keyInventory.createdAt)).limit(filters.perPage).offset(offset);

    return { items: rows, meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) } };
  }

  async getKey(tenantId: string, id: string) {
    const [result] = await db.select().from(keyInventory).where(and(eq(keyInventory.id, id), eq(keyInventory.tenantId, tenantId)));
    return result;
  }

  async updateKey(tenantId: string, id: string, data: Record<string, any>) {
    const [result] = await db.update(keyInventory).set({ ...data, updatedAt: new Date() }).where(and(eq(keyInventory.id, id), eq(keyInventory.tenantId, tenantId))).returning();
    return result;
  }

  async deleteKey(tenantId: string, id: string) {
    const [result] = await db.delete(keyInventory).where(and(eq(keyInventory.id, id), eq(keyInventory.tenantId, tenantId))).returning();
    return result;
  }

  async assignKey(tenantId: string, keyId: string, toHolder: string, performedBy: string, notes?: string) {
    const key = await this.getKey(tenantId, keyId);
    if (!key) return null;

    const [updated] = await db.update(keyInventory).set({
      status: 'assigned',
      currentHolder: toHolder,
      updatedAt: new Date(),
    }).where(and(eq(keyInventory.id, keyId), eq(keyInventory.tenantId, tenantId))).returning();

    await db.insert(keyLogs).values({
      tenantId,
      keyId,
      action: 'assigned',
      fromHolder: key.currentHolder,
      toHolder,
      performedBy,
      notes,
    } as any);

    return updated;
  }

  async returnKey(tenantId: string, keyId: string, performedBy: string, notes?: string) {
    const key = await this.getKey(tenantId, keyId);
    if (!key) return null;

    const [updated] = await db.update(keyInventory).set({
      status: 'available',
      currentHolder: null,
      currentHolderId: null,
      updatedAt: new Date(),
    }).where(and(eq(keyInventory.id, keyId), eq(keyInventory.tenantId, tenantId))).returning();

    await db.insert(keyLogs).values({
      tenantId,
      keyId,
      action: 'returned',
      fromHolder: key.currentHolder,
      performedBy,
      notes,
    } as any);

    return updated;
  }

  async listKeyLogs(tenantId: string, filters: KeyLogFilters) {
    const conditions: any[] = [eq(keyLogs.tenantId, tenantId)];
    if (filters.keyId) conditions.push(eq(keyLogs.keyId, filters.keyId));
    if (filters.action) conditions.push(eq(keyLogs.action, filters.action));

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(keyLogs).where(whereClause);
    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db.select().from(keyLogs).where(whereClause).orderBy(desc(keyLogs.createdAt)).limit(filters.perPage).offset(offset);

    return { items: rows, meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) } };
  }

  async getKeyStats(tenantId: string) {
    const [result] = await db.select({
      total: sql<number>`count(*)::int`,
      available: sql<number>`count(*) filter (where ${keyInventory.status} = 'available')::int`,
      assigned: sql<number>`count(*) filter (where ${keyInventory.status} = 'assigned')::int`,
      lost: sql<number>`count(*) filter (where ${keyInventory.status} = 'lost')::int`,
      retired: sql<number>`count(*) filter (where ${keyInventory.status} = 'retired')::int`,
    }).from(keyInventory).where(eq(keyInventory.tenantId, tenantId));
    return result;
  }
}

export const keyService = new KeyService();
