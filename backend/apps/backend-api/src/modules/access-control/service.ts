import { eq, and, ilike } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accessPeople, accessVehicles, accessLogs } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreatePersonInput, UpdatePersonInput, PersonFilters, CreateVehicleInput, CreateAccessLogInput, AccessLogFilters } from './schemas.js';

class AccessControlService {
  // ── People ──
  async listPeople(tenantId: string, filters?: PersonFilters) {
    const conditions = [eq(accessPeople.tenantId, tenantId)];
    if (filters?.sectionId) conditions.push(eq(accessPeople.sectionId, filters.sectionId));
    if (filters?.type) conditions.push(eq(accessPeople.type, filters.type));
    if (filters?.status) conditions.push(eq(accessPeople.status, filters.status));
    if (filters?.search) conditions.push(ilike(accessPeople.fullName, `%${filters.search}%`));
    return db.select().from(accessPeople).where(and(...conditions)).orderBy(accessPeople.fullName);
  }

  async getPersonById(id: string, tenantId: string) {
    const [item] = await db.select().from(accessPeople)
      .where(and(eq(accessPeople.id, id), eq(accessPeople.tenantId, tenantId))).limit(1);
    if (!item) throw new NotFoundError('Person', id);
    return item;
  }

  async createPerson(data: CreatePersonInput, tenantId: string) {
    const [person] = await db.insert(accessPeople).values({ tenantId, ...data }).returning();
    return person;
  }

  async updatePerson(id: string, data: UpdatePersonInput, tenantId: string) {
    const [person] = await db.update(accessPeople).set({ ...data, updatedAt: new Date() })
      .where(and(eq(accessPeople.id, id), eq(accessPeople.tenantId, tenantId))).returning();
    if (!person) throw new NotFoundError('Person', id);
    return person;
  }

  async deletePerson(id: string, tenantId: string) {
    const [person] = await db.delete(accessPeople)
      .where(and(eq(accessPeople.id, id), eq(accessPeople.tenantId, tenantId))).returning();
    if (!person) throw new NotFoundError('Person', id);
  }

  // ── Vehicles ──
  async listVehicles(tenantId: string, personId?: string) {
    const conditions = [eq(accessVehicles.tenantId, tenantId)];
    if (personId) conditions.push(eq(accessVehicles.personId, personId));
    return db.select().from(accessVehicles).where(and(...conditions)).orderBy(accessVehicles.plate);
  }

  async createVehicle(data: CreateVehicleInput, tenantId: string) {
    const [vehicle] = await db.insert(accessVehicles).values({ tenantId, ...data }).returning();
    return vehicle;
  }

  async deleteVehicle(id: string, tenantId: string) {
    const [vehicle] = await db.delete(accessVehicles)
      .where(and(eq(accessVehicles.id, id), eq(accessVehicles.tenantId, tenantId))).returning();
    if (!vehicle) throw new NotFoundError('Vehicle', id);
  }

  // ── Access Logs ──
  async listLogs(tenantId: string, filters?: AccessLogFilters) {
    const conditions = [eq(accessLogs.tenantId, tenantId)];
    if (filters?.sectionId) conditions.push(eq(accessLogs.sectionId, filters.sectionId));
    if (filters?.personId) conditions.push(eq(accessLogs.personId, filters.personId));
    if (filters?.direction) conditions.push(eq(accessLogs.direction, filters.direction));
    return db.select().from(accessLogs).where(and(...conditions))
      .orderBy(accessLogs.createdAt).limit(500);
  }

  async createLog(data: CreateAccessLogInput, operatorId: string, tenantId: string) {
    const [log] = await db.insert(accessLogs)
      .values({ tenantId, operatorId, ...data }).returning();
    return log;
  }
}

export const accessControlService = new AccessControlService();
