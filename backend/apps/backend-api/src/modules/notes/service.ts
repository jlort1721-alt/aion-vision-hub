import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import type {
  CreateNoteInput,
  UpdateNoteInput,
  NoteFilters,
} from "./schemas.js";

/**
 * Note Service — uses raw SQL to match the actual DB table structure.
 * The operational_notes table has: id, site_id, site_name, apartment, note,
 * authorized_by, note_date, observations, created_at, updated_at
 */
export class NoteService {
  async list(_tenantId: string, filters: NoteFilters) {
    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.search) {
      conditions.push(
        `(note ILIKE $${paramIdx} OR site_name ILIKE $${paramIdx} OR apartment ILIKE $${paramIdx})`,
      );
      params.push(`%${filters.search}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");
    const offset = (filters.page - 1) * filters.perPage;

    const countResult = await db.execute(
      sql.raw(
        `SELECT count(*)::int as count FROM operational_notes WHERE ${whereClause}`,
      ),
    );
    const total =
      (countResult as unknown as Array<{ count: number }>)[0]?.count ?? 0;

    const rows = await db.execute(
      sql.raw(
        `SELECT * FROM operational_notes WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${filters.perPage} OFFSET ${offset}`,
      ),
    );

    return {
      items: [...rows] as Array<Record<string, unknown>>,
      meta: {
        page: filters.page,
        perPage: filters.perPage,
        total,
        totalPages: Math.ceil(total / filters.perPage),
      },
    };
  }

  async getById(id: string, _tenantId: string) {
    const rows = await db.execute(
      sql`SELECT * FROM operational_notes WHERE id = ${id} LIMIT 1`,
    );
    const note = [...rows][0];
    if (!note) return null;
    return note as Record<string, unknown>;
  }

  async create(
    data: CreateNoteInput,
    _tenantId: string,
    _userId: string,
    userName: string,
  ) {
    const rows = await db.execute(
      sql`INSERT INTO operational_notes (id, site_name, apartment, note, authorized_by, note_date, observations, created_at, updated_at)
          VALUES (gen_random_uuid(), ${data.title ?? ""}, ${data.category ?? ""}, ${data.body ?? ""}, ${userName}, ${new Date().toISOString().split("T")[0]}, ${data.priority ?? ""}, now(), now())
          RETURNING *`,
    );
    return [...rows][0] as Record<string, unknown>;
  }

  async update(id: string, data: UpdateNoteInput, _tenantId: string) {
    const sets: string[] = ["updated_at = now()"];
    if (data.title !== undefined)
      sets.push(`site_name = '${data.title.replace(/'/g, "''")}'`);
    if (data.body !== undefined)
      sets.push(`note = '${data.body.replace(/'/g, "''")}'`);
    if (data.category !== undefined)
      sets.push(`apartment = '${data.category.replace(/'/g, "''")}'`);

    const rows = await db.execute(
      sql.raw(
        `UPDATE operational_notes SET ${sets.join(", ")} WHERE id = '${id}' RETURNING *`,
      ),
    );
    const note = [...rows][0];
    if (!note) return null;
    return note as Record<string, unknown>;
  }

  async delete(id: string, _tenantId: string) {
    const rows = await db.execute(
      sql`DELETE FROM operational_notes WHERE id = ${id} RETURNING *`,
    );
    const note = [...rows][0];
    return note as Record<string, unknown> | undefined;
  }
}

export const noteService = new NoteService();
