import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { liveRecordings } from "../../db/schema/index.js";
import type { StartRecordingInput } from "./schemas.js";

export class LiveRecordingsService {
  async list(tenantId: string, cameraId?: string) {
    const conditions = [eq(liveRecordings.tenantId, tenantId)];
    if (cameraId) conditions.push(eq(liveRecordings.cameraId, cameraId));

    return db
      .select()
      .from(liveRecordings)
      .where(and(...conditions))
      .orderBy(desc(liveRecordings.createdAt))
      .limit(50);
  }

  async getById(tenantId: string, id: string) {
    const [row] = await db
      .select()
      .from(liveRecordings)
      .where(
        and(eq(liveRecordings.id, id), eq(liveRecordings.tenantId, tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async start(tenantId: string, userId: string, input: StartRecordingInput) {
    const [row] = await db
      .insert(liveRecordings)
      .values({
        tenantId,
        cameraId: input.cameraId,
        startedBy: userId,
        durationSec: input.durationSec,
        reason: input.reason,
        status: "pending",
      })
      .returning();
    return row;
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: { storageUrl?: string; fileSizeBytes?: number; endedAt?: Date },
  ) {
    const [row] = await db
      .update(liveRecordings)
      .set({ status, ...extra })
      .where(eq(liveRecordings.id, id))
      .returning();
    return row ?? null;
  }
}

export const liveRecordingsService = new LiveRecordingsService();
