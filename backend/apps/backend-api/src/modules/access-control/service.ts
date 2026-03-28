import { eq, and, or, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accessPeople, accessVehicles, accessLogs } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreatePersonInput, UpdatePersonInput, PersonFilters, CreateVehicleInput, UpdateVehicleInput, VehicleFilters, CreateAccessLogInput, AccessLogFilters } from './schemas.js';

class AccessControlService {
  // ── People ──
  async listPeople(tenantId: string, filters: PersonFilters = {}) {
    const page = filters.page || 1;
    const perPage = Math.min(filters.perPage || 50, 500);
    const offset = (page - 1) * perPage;

    const conditions = [eq(accessPeople.tenantId, tenantId)];
    if (filters.sectionId) conditions.push(eq(accessPeople.sectionId, filters.sectionId));
    if (filters.type) conditions.push(eq(accessPeople.type, filters.type));
    if (filters.status) conditions.push(eq(accessPeople.status, filters.status));
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(or(
        ilike(accessPeople.fullName, searchTerm),
        ilike(accessPeople.phone, searchTerm),
        ilike(accessPeople.documentId, searchTerm),
        ilike(accessPeople.unit, searchTerm),
        ilike(accessPeople.email, searchTerm),
      )!);
    }

    const where = and(...conditions);
    const [items, countResult] = await Promise.all([
      db.select().from(accessPeople).where(where).orderBy(accessPeople.fullName).limit(perPage).offset(offset),
      db.select({ count: sql`count(*)` }).from(accessPeople).where(where),
    ]);

    const total = Number(countResult[0]?.count || 0);
    return { items, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
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
  async listVehicles(tenantId: string, filters: VehicleFilters = {}) {
    const page = filters.page || 1;
    const perPage = Math.min(filters.perPage || 50, 500);
    const offset = (page - 1) * perPage;

    const conditions = [eq(accessVehicles.tenantId, tenantId)];
    if (filters.personId) conditions.push(eq(accessVehicles.personId, filters.personId));
    if (filters.type) conditions.push(eq(accessVehicles.type, filters.type));
    if (filters.status) conditions.push(eq(accessVehicles.status, filters.status));
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(or(
        ilike(accessVehicles.plate, searchTerm),
        ilike(accessVehicles.brand, searchTerm),
        ilike(accessVehicles.model, searchTerm),
        ilike(accessVehicles.color, searchTerm),
      )!);
    }

    const where = and(...conditions);
    const [items, countResult] = await Promise.all([
      db.select().from(accessVehicles).where(where).orderBy(accessVehicles.plate).limit(perPage).offset(offset),
      db.select({ count: sql`count(*)` }).from(accessVehicles).where(where),
    ]);

    const total = Number(countResult[0]?.count || 0);
    return { items, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async createVehicle(data: CreateVehicleInput, tenantId: string) {
    const [vehicle] = await db.insert(accessVehicles).values({ tenantId, ...data }).returning();
    return vehicle;
  }

  async updateVehicle(id: string, data: UpdateVehicleInput, tenantId: string) {
    const [vehicle] = await db.update(accessVehicles).set({ ...data })
      .where(and(eq(accessVehicles.id, id), eq(accessVehicles.tenantId, tenantId))).returning();
    if (!vehicle) throw new NotFoundError('Vehicle', id);
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
