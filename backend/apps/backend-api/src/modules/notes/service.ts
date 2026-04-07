import { eq, and, sql, desc, ilike, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { operationalNotes } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateNoteInput, UpdateNoteInput, NoteFilters } from './schemas.js';

export class NoteService {
  async list(tenantId: string, filters: NoteFilters) {
    const conditions = [eq(operationalNotes.tenantId, tenantId)];

    if (filters.category) conditions.push(eq(operationalNotes.category, filters.category));
    if (filters.pinned !== undefined) conditions.push(eq(operationalNotes.isPinned, filters.pinned));
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(or(ilike(operationalNotes.title, pattern), ilike(operationalNotes.body, pattern))!);
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(operationalNotes)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(operationalNotes)
      .where(whereClause)
      .orderBy(desc(operationalNotes.isPinned), desc(operationalNotes.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getById(id: string, tenantId: string) {
    const [note] = await db
      .select()
      .from(operationalNotes)
      .where(and(eq(operationalNotes.id, id), eq(operationalNotes.tenantId, tenantId)))
      .limit(1);
    if (!note) throw new NotFoundError('OperationalNote', id);
    return note;
  }

  async create(data: CreateNoteInput, tenantId: string, userId: string, userName: string) {
    const [note] = await db
      .insert(operationalNotes)
      .values({
        tenantId,
        title: data.title,
        body: data.body,
        category: data.category,
        priority: data.priority,
        isPinned: data.isPinned,
        authorId: userId,
        authorName: userName,
      })
      .returning();
    return note;
  }

  async update(id: string, data: UpdateNoteInput, tenantId: string) {
    const [note] = await db
      .update(operationalNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(operationalNotes.id, id), eq(operationalNotes.tenantId, tenantId)))
      .returning();
    if (!note) throw new NotFoundError('OperationalNote', id);
    return note;
  }

  async delete(id: string, tenantId: string) {
    const [note] = await db
      .delete(operationalNotes)
      .where(and(eq(operationalNotes.id, id), eq(operationalNotes.tenantId, tenantId)))
      .returning();
    if (!note) throw new NotFoundError('OperationalNote', id);
    return note;
  }
}

export const noteService = new NoteService();
