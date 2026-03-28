import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { domoticDevices, domoticActions } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateDomoticDeviceInput, UpdateDomoticDeviceInput, DomoticFilters } from './schemas.js';

class DomoticService {
  async list(tenantId: string, filters?: DomoticFilters) {
    const conditions = [eq(domoticDevices.tenantId, tenantId)];
    if (filters?.sectionId) conditions.push(eq(domoticDevices.sectionId, filters.sectionId));
    if (filters?.status) conditions.push(eq(domoticDevices.status, filters.status));
    if (filters?.type) conditions.push(eq(domoticDevices.type, filters.type));
    return db.select().from(domoticDevices).where(and(...conditions)).orderBy(domoticDevices.name);
  }

  async getById(id: string, tenantId: string) {
    const [item] = await db.select().from(domoticDevices)
      .where(and(eq(domoticDevices.id, id), eq(domoticDevices.tenantId, tenantId))).limit(1);
    if (!item) throw new NotFoundError('Domotic device', id);
    return item;
  }

  async create(data: CreateDomoticDeviceInput, tenantId: string) {
    const [device] = await db.insert(domoticDevices)
      .values({ tenantId, ...data }).returning();
    return device;
  }

  async update(id: string, data: UpdateDomoticDeviceInput, tenantId: string) {
    const [device] = await db.update(domoticDevices)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(domoticDevices.id, id), eq(domoticDevices.tenantId, tenantId))).returning();
    if (!device) throw new NotFoundError('Domotic device', id);
    return device;
  }

  async delete(id: string, tenantId: string) {
    const [device] = await db.delete(domoticDevices)
      .where(and(eq(domoticDevices.id, id), eq(domoticDevices.tenantId, tenantId))).returning();
    if (!device) throw new NotFoundError('Domotic device', id);
  }

  async executeAction(deviceId: string, action: string, userId: string, tenantId: string) {
    const device = await this.getById(deviceId, tenantId);
    const newState = action === 'toggle' ? (device.state === 'on' ? 'off' : 'on') : device.state;

    await db.update(domoticDevices).set({
      state: newState, lastAction: action, lastSync: new Date(), updatedAt: new Date(),
    }).where(eq(domoticDevices.id, deviceId));

    const [log] = await db.insert(domoticActions)
      .values({ tenantId, deviceId, action, result: newState, userId }).returning();
    return { device: { ...device, state: newState }, action: log };
  }

  async getActions(deviceId: string, tenantId: string) {
    return db.select().from(domoticActions)
      .where(and(eq(domoticActions.deviceId, deviceId), eq(domoticActions.tenantId, tenantId)))
      .orderBy(domoticActions.createdAt).limit(100);
  }
}

export const domoticService = new DomoticService();
