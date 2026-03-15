import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { devices, sites } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateDeviceInput, UpdateDeviceInput, DeviceFilters } from './schemas.js';

export class DeviceService {
  /**
   * List devices for a tenant with optional filters and pagination.
   * Supports up to 1000+ devices efficiently.
   */
  async list(tenantId: string, filters?: DeviceFilters) {
    const conditions = [eq(devices.tenantId, tenantId)];

    if (filters?.siteId) {
      conditions.push(eq(devices.siteId, filters.siteId));
    }
    if (filters?.status) {
      conditions.push(eq(devices.status, filters.status));
    }
    if (filters?.brand) {
      conditions.push(eq(devices.brand, filters.brand));
    }

    const whereClause = and(...conditions);
    const page = filters?.page ?? 1;
    const perPage = filters?.perPage ?? 100;
    const offset = (page - 1) * perPage;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const rows = await db
      .select()
      .from(devices)
      .where(whereClause)
      .orderBy(devices.createdAt)
      .limit(perPage)
      .offset(offset);

    return {
      items: rows,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get a single device by ID, scoped to tenant.
   */
  async getById(id: string, tenantId: string) {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
      .limit(1);

    if (!device) throw new NotFoundError('Device', id);
    return device;
  }

  /**
   * Create a new device. The username/password are stored as a credential
   * reference (encrypted externally) rather than in plaintext.
   */
  async create(data: CreateDeviceInput, tenantId: string) {
    // Verify the target site belongs to this tenant
    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.id, data.siteId), eq(sites.tenantId, tenantId)))
      .limit(1);

    if (!site) throw new NotFoundError('Site', data.siteId);

    // In production, encrypt credentials and store a reference.
    // For now we store a placeholder ref keyed to the device.
    const credentialRef = `enc:${tenantId}:${crypto.randomUUID()}`;

    const [device] = await db
      .insert(devices)
      .values({
        tenantId,
        siteId: data.siteId,
        name: data.name,
        brand: data.brand,
        model: data.model ?? null,
        type: data.type,
        ip: data.ip,
        port: data.port,
        channels: data.channels ?? 1,
        tags: data.tags ?? [],
        credentialRef,
        status: 'unknown',
      })
      .returning();

    return device;
  }

  /**
   * Partially update a device.
   */
  async update(id: string, data: UpdateDeviceInput, tenantId: string) {
    // Strip credential fields — they need separate handling
    const { username: _u, password: _p, ...safeData } = data;

    const [device] = await db
      .update(devices)
      .set({ ...safeData, updatedAt: new Date() })
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
      .returning();

    if (!device) throw new NotFoundError('Device', id);
    return device;
  }

  /**
   * Delete a device.
   */
  async delete(id: string, tenantId: string) {
    const [device] = await db
      .delete(devices)
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
      .returning();

    if (!device) throw new NotFoundError('Device', id);
  }

  /**
   * Touch the lastSeenAt timestamp (called after a successful health check).
   */
  async touchLastSeen(id: string, tenantId: string) {
    await db
      .update(devices)
      .set({ lastSeenAt: new Date(), status: 'online', updatedAt: new Date() })
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)));
  }
}

export const deviceService = new DeviceService();
