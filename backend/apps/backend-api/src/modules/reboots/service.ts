import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { rebootTasks } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateRebootTaskInput, CompleteRebootInput, RebootFilters } from './schemas.js';

class RebootService {
  async list(tenantId: string, filters?: RebootFilters) {
    const conditions = [eq(rebootTasks.tenantId, tenantId)];
    if (filters?.status) conditions.push(eq(rebootTasks.status, filters.status));
    if (filters?.deviceId) conditions.push(eq(rebootTasks.deviceId, filters.deviceId));
    if (filters?.sectionId) conditions.push(eq(rebootTasks.sectionId, filters.sectionId));
    return db.select().from(rebootTasks).where(and(...conditions))
      .orderBy(rebootTasks.createdAt).limit(500);
  }

  async getById(id: string, tenantId: string) {
    const [item] = await db.select().from(rebootTasks)
      .where(and(eq(rebootTasks.id, id), eq(rebootTasks.tenantId, tenantId))).limit(1);
    if (!item) throw new NotFoundError('Reboot task', id);
    return item;
  }

  async create(data: CreateRebootTaskInput, initiatedBy: string, tenantId: string) {
    const [task] = await db.insert(rebootTasks)
      .values({ tenantId, initiatedBy, ...data }).returning();
    return task;
  }

  async complete(id: string, data: CompleteRebootInput, tenantId: string) {
    const [task] = await db.update(rebootTasks).set({
      status: data.status, result: data.result,
      recoveryTimeSeconds: data.recoveryTimeSeconds,
      completedAt: new Date(),
    }).where(and(eq(rebootTasks.id, id), eq(rebootTasks.tenantId, tenantId))).returning();
    if (!task) throw new NotFoundError('Reboot task', id);
    return task;
  }
}

export const rebootService = new RebootService();
