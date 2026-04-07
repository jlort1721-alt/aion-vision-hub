import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { sites, devices } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateSiteInput, UpdateSiteInput } from './schemas.js';

export class SiteService {
  /**
   * List all sites for a tenant.
   */
  async list(tenantId: string) {
    const rows = await db
      .select()
      .from(sites)
      .where(eq(sites.tenantId, tenantId))
      .orderBy(sites.name);

    return rows;
  }

  /**
   * Get a single site by ID, scoped to tenant.
   */
  async getById(id: string, tenantId: string) {
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId)))
      .limit(1);

    if (!site) throw new NotFoundError('Site', id);
    return site;
  }

  /**
   * Create a new site.
   */
  async create(data: CreateSiteInput, tenantId: string) {
    const [site] = await db
      .insert(sites)
      .values({
        tenantId,
        name: data.name,
        address: data.address ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        timezone: data.timezone,
        wanIp: data.wanIp ?? null,
        status: data.status ?? 'unknown',
      })
      .returning();

    return site;
  }

  /**
   * Partially update a site.
   */
  async update(id: string, data: UpdateSiteInput, tenantId: string) {
    const [site] = await db
      .update(sites)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId)))
      .returning();

    if (!site) throw new NotFoundError('Site', id);
    return site;
  }

  /**
   * Delete a site. Cascading FK will also remove linked devices.
   */
  async delete(id: string, tenantId: string) {
    const [site] = await db
      .delete(sites)
      .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId)))
      .returning();

    if (!site) throw new NotFoundError('Site', id);
  }

  /**
   * List all devices that belong to a specific site.
   */
  async listDevices(siteId: string, tenantId: string) {
    // Ensure the site belongs to this tenant first
    await this.getById(siteId, tenantId);

    const rows = await db
      .select()
      .from(devices)
      .where(and(eq(devices.siteId, siteId), eq(devices.tenantId, tenantId)))
      .orderBy(devices.name);

    return rows;
  }
}

export const siteService = new SiteService();
