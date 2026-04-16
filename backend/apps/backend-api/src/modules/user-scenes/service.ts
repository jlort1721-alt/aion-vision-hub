import { eq, and, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { userScenes } from "../../db/schema/index.js";
import type { CreateSceneInput, UpdateSceneInput } from "./schemas.js";

export class UserScenesService {
  async list(tenantId: string, userId: string) {
    return db
      .select()
      .from(userScenes)
      .where(
        and(
          eq(userScenes.tenantId, tenantId),
          or(eq(userScenes.userId, userId), eq(userScenes.isShared, true)),
        ),
      )
      .orderBy(userScenes.name);
  }

  async getById(tenantId: string, id: string) {
    const [row] = await db
      .select()
      .from(userScenes)
      .where(and(eq(userScenes.id, id), eq(userScenes.tenantId, tenantId)))
      .limit(1);
    return row ?? null;
  }

  async create(tenantId: string, userId: string, input: CreateSceneInput) {
    const [row] = await db
      .insert(userScenes)
      .values({
        tenantId,
        userId,
        name: input.name,
        layout: input.layout,
        isShared: input.isShared,
      })
      .returning();
    return row;
  }

  async update(tenantId: string, id: string, input: UpdateSceneInput) {
    const [row] = await db
      .update(userScenes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(userScenes.id, id), eq(userScenes.tenantId, tenantId)))
      .returning();
    return row ?? null;
  }

  async remove(tenantId: string, id: string) {
    const [row] = await db
      .delete(userScenes)
      .where(and(eq(userScenes.id, id), eq(userScenes.tenantId, tenantId)))
      .returning();
    return row ?? null;
  }
}

export const userScenesService = new UserScenesService();
