import { eq, and, sql, desc, asc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { incidents } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateIncidentInput,
  UpdateIncidentInput,
  AddEvidenceInput,
  AddCommentInput,
  IncidentFilters,
} from './schemas.js';

export class IncidentService {
  /**
   * List incidents with filters and pagination.
   */
  async list(tenantId: string, filters: IncidentFilters) {
    const conditions = [eq(incidents.tenantId, tenantId)];

    if (filters.priority) {
      conditions.push(eq(incidents.priority, filters.priority));
    }
    if (filters.status) {
      conditions.push(eq(incidents.status, filters.status));
    }
    if (filters.siteId) {
      conditions.push(eq(incidents.siteId, filters.siteId));
    }
    if (filters.assignedTo) {
      conditions.push(eq(incidents.assignedTo, filters.assignedTo));
    }
    if (filters.from) {
      conditions.push(gte(incidents.createdAt, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(incidents.createdAt, new Date(filters.to)));
    }

    const whereClause = and(...conditions);

    // Count total matching rows
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(incidents)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / filters.perPage);
    const offset = (filters.page - 1) * filters.perPage;

    // Determine sort column
    const sortColumn = {
      createdAt: incidents.createdAt,
      priority: incidents.priority,
      status: incidents.status,
    }[filters.sortBy];

    const orderFn = filters.sortOrder === 'asc' ? asc : desc;

    const rows = await db
      .select()
      .from(incidents)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: {
        page: filters.page,
        perPage: filters.perPage,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a single incident by ID, scoped to tenant.
   */
  async getById(id: string, tenantId: string) {
    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)))
      .limit(1);

    if (!incident) throw new NotFoundError('Incident', id);
    return incident;
  }

  /**
   * Create a new incident.
   */
  async create(data: CreateIncidentInput, tenantId: string, userId: string) {
    const [incident] = await db
      .insert(incidents)
      .values({
        tenantId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: 'open',
        siteId: data.siteId ?? null,
        eventIds: data.eventIds ?? [],
        evidence: [],
        comments: [],
        createdBy: userId,
      })
      .returning();

    return incident;
  }

  /**
   * Partially update an incident.
   */
  async update(id: string, data: UpdateIncidentInput, tenantId: string) {
    const now = new Date();
    const timestampFields: Record<string, Date> = {};

    if (data.status === 'resolved') {
      timestampFields.resolvedAt = now;
    } else if (data.status === 'closed') {
      timestampFields.closedAt = now;
    }

    const [incident] = await db
      .update(incidents)
      .set({
        ...data,
        ...timestampFields,
        updatedAt: now,
      })
      .where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)))
      .returning();

    if (!incident) throw new NotFoundError('Incident', id);
    return incident;
  }

  /**
   * Append evidence to an incident's evidence JSONB array.
   */
  async addEvidence(
    id: string,
    data: AddEvidenceInput,
    userId: string,
    tenantId: string,
  ) {
    // Fetch current incident to append to its evidence array
    const existing = await this.getById(id, tenantId);

    const evidenceEntry = {
      id: crypto.randomUUID(),
      type: data.type,
      url: data.url ?? null,
      content: data.content ?? null,
      addedBy: userId,
      addedAt: new Date().toISOString(),
    };

    const currentEvidence = Array.isArray(existing.evidence) ? existing.evidence : [];

    const [incident] = await db
      .update(incidents)
      .set({
        evidence: [...currentEvidence, evidenceEntry],
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)))
      .returning();

    if (!incident) throw new NotFoundError('Incident', id);
    return incident;
  }

  /**
   * Append a comment to an incident's comments JSONB array.
   */
  async addComment(
    id: string,
    data: AddCommentInput,
    userId: string,
    userName: string,
    tenantId: string,
  ) {
    const existing = await this.getById(id, tenantId);

    const commentEntry = {
      id: crypto.randomUUID(),
      content: data.content,
      authorId: userId,
      authorName: userName,
      createdAt: new Date().toISOString(),
    };

    const currentComments = Array.isArray(existing.comments) ? existing.comments : [];

    const [incident] = await db
      .update(incidents)
      .set({
        comments: [...currentComments, commentEntry],
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)))
      .returning();

    if (!incident) throw new NotFoundError('Incident', id);
    return incident;
  }
}

export const incidentService = new IncidentService();
