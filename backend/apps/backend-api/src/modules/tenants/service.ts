import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { tenants } from '../../db/schema/index.js';
import { NotFoundError, ForbiddenError } from '@aion/shared-contracts';

export class TenantService {
  async list(tenantId: string, role: string) {
    if (role === 'super_admin') {
      return db.select().from(tenants);
    }
    return db.select().from(tenants).where(eq(tenants.id, tenantId));
  }

  async getById(id: string, tenantId: string, role: string) {
    if (role !== 'super_admin' && id !== tenantId) throw new ForbiddenError();
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!tenant) throw new NotFoundError('Tenant', id);
    return tenant;
  }

  async create(data: { name: string; slug: string }) {
    const [tenant] = await db.insert(tenants).values({
      name: data.name,
      slug: data.slug,
    }).returning();
    return tenant;
  }

  async update(id: string, data: Record<string, unknown>, tenantId: string, role: string) {
    if (role !== 'super_admin' && id !== tenantId) throw new ForbiddenError();
    const [tenant] = await db.update(tenants).set({ ...data, updatedAt: new Date() }).where(eq(tenants.id, id)).returning();
    if (!tenant) throw new NotFoundError('Tenant', id);
    return tenant;
  }

  async delete(id: string) {
    const [tenant] = await db.delete(tenants).where(eq(tenants.id, id)).returning();
    if (!tenant) throw new NotFoundError('Tenant', id);
  }

  async getSettings(id: string, tenantId: string, role: string) {
    const tenant = await this.getById(id, tenantId, role);
    return tenant.settings;
  }
}
