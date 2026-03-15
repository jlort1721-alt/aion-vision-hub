import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { intercomDevices, intercomCalls } from '../../db/schema/index.js';
import type { CreateIntercomDeviceInput, UpdateIntercomDeviceInput, IntercomFilters, CreateCallLogInput, CallLogFilters } from './schemas.js';

class IntercomService {
  async listDevices(tenantId: string, filters?: IntercomFilters) {
    const conditions = [eq(intercomDevices.tenantId, tenantId)];
    if (filters?.sectionId) conditions.push(eq(intercomDevices.sectionId, filters.sectionId));
    if (filters?.status) conditions.push(eq(intercomDevices.status, filters.status));
    return db.select().from(intercomDevices).where(and(...conditions)).orderBy(intercomDevices.name);
  }

  async getDeviceById(id: string, tenantId: string) {
    const [item] = await db.select().from(intercomDevices)
      .where(and(eq(intercomDevices.id, id), eq(intercomDevices.tenantId, tenantId))).limit(1);
    if (!item) throw new Error(`Intercom device ${id} not found`);
    return item;
  }

  async createDevice(data: CreateIntercomDeviceInput, tenantId: string) {
    const [device] = await db.insert(intercomDevices).values({ tenantId, ...data }).returning();
    return device;
  }

  async updateDevice(id: string, data: UpdateIntercomDeviceInput, tenantId: string) {
    const [device] = await db.update(intercomDevices).set({ ...data, updatedAt: new Date() })
      .where(and(eq(intercomDevices.id, id), eq(intercomDevices.tenantId, tenantId))).returning();
    if (!device) throw new Error(`Intercom device ${id} not found`);
    return device;
  }

  async deleteDevice(id: string, tenantId: string) {
    const [device] = await db.delete(intercomDevices)
      .where(and(eq(intercomDevices.id, id), eq(intercomDevices.tenantId, tenantId))).returning();
    if (!device) throw new Error(`Intercom device ${id} not found`);
  }

  async listCalls(tenantId: string, filters?: CallLogFilters) {
    const conditions = [eq(intercomCalls.tenantId, tenantId)];
    if (filters?.deviceId) conditions.push(eq(intercomCalls.deviceId, filters.deviceId));
    if (filters?.sectionId) conditions.push(eq(intercomCalls.sectionId, filters.sectionId));
    if (filters?.direction) conditions.push(eq(intercomCalls.direction, filters.direction));
    return db.select().from(intercomCalls).where(and(...conditions))
      .orderBy(intercomCalls.createdAt).limit(500);
  }

  async createCallLog(data: CreateCallLogInput, tenantId: string) {
    const [call] = await db.insert(intercomCalls).values({ tenantId, ...data }).returning();
    return call;
  }
}

export const intercomService = new IntercomService();
