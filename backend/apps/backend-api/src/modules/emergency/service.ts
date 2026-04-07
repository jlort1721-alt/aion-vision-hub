import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  emergencyProtocols,
  emergencyContacts,
  emergencyActivations,
} from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateProtocolInput,
  UpdateProtocolInput,
  ProtocolFilters,
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
  CreateActivationInput,
  ActivationFilters,
} from './schemas.js';

export class EmergencyService {
  // ══════════════════════════════════════════════════════════
  // PROTOCOLS
  // ══════════════════════════════════════════════════════════

  async listProtocols(tenantId: string, filters: ProtocolFilters) {
    const conditions = [eq(emergencyProtocols.tenantId, tenantId)];

    if (filters.type) {
      conditions.push(eq(emergencyProtocols.type, filters.type));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(emergencyProtocols.isActive, filters.isActive));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emergencyProtocols)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(emergencyProtocols)
      .where(whereClause)
      .orderBy(desc(emergencyProtocols.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getProtocolById(id: string, tenantId: string) {
    const [protocol] = await db
      .select()
      .from(emergencyProtocols)
      .where(and(eq(emergencyProtocols.id, id), eq(emergencyProtocols.tenantId, tenantId)))
      .limit(1);
    if (!protocol) throw new NotFoundError('EmergencyProtocol', id);
    return protocol;
  }

  async createProtocol(data: CreateProtocolInput, tenantId: string) {
    const [protocol] = await db
      .insert(emergencyProtocols)
      .values({
        tenantId,
        name: data.name,
        type: data.type,
        description: data.description ?? null,
        steps: data.steps,
        autoActions: data.autoActions,
        priority: data.priority,
        isActive: data.isActive,
      })
      .returning();
    return protocol;
  }

  async updateProtocol(id: string, data: UpdateProtocolInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.steps !== undefined) updateData.steps = data.steps;
    if (data.autoActions !== undefined) updateData.autoActions = data.autoActions;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [protocol] = await db
      .update(emergencyProtocols)
      .set(updateData)
      .where(and(eq(emergencyProtocols.id, id), eq(emergencyProtocols.tenantId, tenantId)))
      .returning();

    if (!protocol) throw new NotFoundError('EmergencyProtocol', id);
    return protocol;
  }

  async deleteProtocol(id: string, tenantId: string) {
    const [protocol] = await db
      .delete(emergencyProtocols)
      .where(and(eq(emergencyProtocols.id, id), eq(emergencyProtocols.tenantId, tenantId)))
      .returning();
    if (!protocol) throw new NotFoundError('EmergencyProtocol', id);
    return protocol;
  }

  // ══════════════════════════════════════════════════════════
  // CONTACTS
  // ══════════════════════════════════════════════════════════

  async listContacts(tenantId: string, filters: ContactFilters) {
    const conditions = [eq(emergencyContacts.tenantId, tenantId)];

    if (filters.role) {
      conditions.push(eq(emergencyContacts.role, filters.role));
    }
    if (filters.siteId) {
      conditions.push(eq(emergencyContacts.siteId, filters.siteId));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(emergencyContacts.isActive, filters.isActive));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emergencyContacts)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(emergencyContacts)
      .where(whereClause)
      .orderBy(desc(emergencyContacts.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getContactById(id: string, tenantId: string) {
    const [contact] = await db
      .select()
      .from(emergencyContacts)
      .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.tenantId, tenantId)))
      .limit(1);
    if (!contact) throw new NotFoundError('EmergencyContact', id);
    return contact;
  }

  async createContact(data: CreateContactInput, tenantId: string) {
    const [contact] = await db
      .insert(emergencyContacts)
      .values({
        tenantId,
        siteId: data.siteId ?? null,
        name: data.name,
        role: data.role,
        phone: data.phone,
        email: data.email ?? null,
        priority: data.priority,
        availableHours: data.availableHours ?? null,
        isActive: data.isActive,
      })
      .returning();
    return contact;
  }

  async updateContact(id: string, data: UpdateContactInput, tenantId: string) {
    const updateData: Record<string, unknown> = {};
    if (data.siteId !== undefined) updateData.siteId = data.siteId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.availableHours !== undefined) updateData.availableHours = data.availableHours;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [contact] = await db
      .update(emergencyContacts)
      .set(updateData)
      .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.tenantId, tenantId)))
      .returning();

    if (!contact) throw new NotFoundError('EmergencyContact', id);
    return contact;
  }

  async deleteContact(id: string, tenantId: string) {
    const [contact] = await db
      .delete(emergencyContacts)
      .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.tenantId, tenantId)))
      .returning();
    if (!contact) throw new NotFoundError('EmergencyContact', id);
    return contact;
  }

  // ══════════════════════════════════════════════════════════
  // ACTIVATIONS
  // ══════════════════════════════════════════════════════════

  async listActivations(tenantId: string, filters: ActivationFilters) {
    const conditions = [eq(emergencyActivations.tenantId, tenantId)];

    if (filters.status) conditions.push(eq(emergencyActivations.status, filters.status));
    if (filters.protocolId) conditions.push(eq(emergencyActivations.protocolId, filters.protocolId));
    if (filters.siteId) conditions.push(eq(emergencyActivations.siteId, filters.siteId));
    if (filters.from) conditions.push(gte(emergencyActivations.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(emergencyActivations.createdAt, new Date(filters.to)));

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emergencyActivations)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select({
        id: emergencyActivations.id,
        tenantId: emergencyActivations.tenantId,
        protocolId: emergencyActivations.protocolId,
        siteId: emergencyActivations.siteId,
        activatedBy: emergencyActivations.activatedBy,
        status: emergencyActivations.status,
        timeline: emergencyActivations.timeline,
        resolvedBy: emergencyActivations.resolvedBy,
        resolvedAt: emergencyActivations.resolvedAt,
        resolution: emergencyActivations.resolution,
        createdAt: emergencyActivations.createdAt,
        updatedAt: emergencyActivations.updatedAt,
        // Enrichment: protocol name and type via LEFT JOIN
        protocolName: emergencyProtocols.name,
        protocolType: emergencyProtocols.type,
      })
      .from(emergencyActivations)
      .leftJoin(emergencyProtocols, eq(emergencyActivations.protocolId, emergencyProtocols.id))
      .where(whereClause)
      .orderBy(desc(emergencyActivations.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getActivationById(id: string, tenantId: string) {
    const [activation] = await db
      .select()
      .from(emergencyActivations)
      .where(and(eq(emergencyActivations.id, id), eq(emergencyActivations.tenantId, tenantId)))
      .limit(1);
    if (!activation) throw new NotFoundError('EmergencyActivation', id);
    return activation;
  }

  async activateProtocol(data: CreateActivationInput, tenantId: string, userId: string) {
    const now = new Date();
    const initialTimeline = [
      { action: 'activated', by: userId, at: now.toISOString(), note: 'Protocol activated' },
    ];

    const [activation] = await db
      .insert(emergencyActivations)
      .values({
        tenantId,
        protocolId: data.protocolId,
        siteId: data.siteId ?? null,
        activatedBy: userId,
        status: 'active',
        timeline: initialTimeline,
      })
      .returning();
    return activation;
  }

  async resolveActivation(id: string, tenantId: string, userId: string, resolution?: string) {
    const existing = await this.getActivationById(id, tenantId);
    const now = new Date();
    const currentTimeline = (existing.timeline as Record<string, unknown>[]) ?? [];
    const updatedTimeline = [
      ...currentTimeline,
      { action: 'resolved', by: userId, at: now.toISOString(), note: resolution ?? 'Resolved' },
    ];

    const [activation] = await db
      .update(emergencyActivations)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: now,
        resolution: resolution ?? null,
        timeline: updatedTimeline,
        updatedAt: now,
      })
      .where(and(eq(emergencyActivations.id, id), eq(emergencyActivations.tenantId, tenantId)))
      .returning();

    if (!activation) throw new NotFoundError('EmergencyActivation', id);
    return activation;
  }

  async cancelActivation(id: string, tenantId: string, userId: string, resolution?: string) {
    const existing = await this.getActivationById(id, tenantId);
    const now = new Date();
    const currentTimeline = (existing.timeline as Record<string, unknown>[]) ?? [];
    const updatedTimeline = [
      ...currentTimeline,
      { action: 'cancelled', by: userId, at: now.toISOString(), note: resolution ?? 'Cancelled' },
    ];

    const [activation] = await db
      .update(emergencyActivations)
      .set({
        status: 'cancelled',
        resolvedBy: userId,
        resolvedAt: now,
        resolution: resolution ?? null,
        timeline: updatedTimeline,
        updatedAt: now,
      })
      .where(and(eq(emergencyActivations.id, id), eq(emergencyActivations.tenantId, tenantId)))
      .returning();

    if (!activation) throw new NotFoundError('EmergencyActivation', id);
    return activation;
  }

  async getActivationStats(tenantId: string) {
    const [activationStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${emergencyActivations.status} = 'active')::int`,
        resolved: sql<number>`count(*) filter (where ${emergencyActivations.status} = 'resolved')::int`,
        cancelled: sql<number>`count(*) filter (where ${emergencyActivations.status} = 'cancelled')::int`,
        falseAlarm: sql<number>`count(*) filter (where ${emergencyActivations.status} = 'false_alarm')::int`,
        resolvedToday: sql<number>`count(*) filter (where ${emergencyActivations.status} = 'resolved' and ${emergencyActivations.resolvedAt} >= current_date)::int`,
      })
      .from(emergencyActivations)
      .where(eq(emergencyActivations.tenantId, tenantId));

    const [protocolCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emergencyProtocols)
      .where(eq(emergencyProtocols.tenantId, tenantId));

    const [contactCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emergencyContacts)
      .where(eq(emergencyContacts.tenantId, tenantId));

    return {
      activeEmergencies: activationStats?.active ?? 0,
      totalProtocols: protocolCount?.count ?? 0,
      emergencyContacts: contactCount?.count ?? 0,
      resolvedToday: activationStats?.resolvedToday ?? 0,
      total: activationStats?.total ?? 0,
      byStatus: {
        active: activationStats?.active ?? 0,
        resolved: activationStats?.resolved ?? 0,
        cancelled: activationStats?.cancelled ?? 0,
        false_alarm: activationStats?.falseAlarm ?? 0,
      },
    };
  }
}

export const emergencyService = new EmergencyService();
