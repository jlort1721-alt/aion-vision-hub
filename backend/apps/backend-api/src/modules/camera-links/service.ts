import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { cameraLinks } from "../../db/schema/index.js";
import { devices } from "../../db/schema/index.js";
import type { CreateCameraLinkInput } from "./schemas.js";

export class CameraLinksService {
  async listByCamera(tenantId: string, cameraId: string) {
    const rows = await db
      .select({
        id: cameraLinks.id,
        cameraId: cameraLinks.cameraId,
        linkedDeviceId: cameraLinks.linkedDeviceId,
        linkType: cameraLinks.linkType,
        priority: cameraLinks.priority,
        createdAt: cameraLinks.createdAt,
        deviceName: devices.name,
        deviceStatus: devices.status,
      })
      .from(cameraLinks)
      .leftJoin(devices, eq(devices.id, cameraLinks.linkedDeviceId))
      .where(
        and(
          eq(cameraLinks.tenantId, tenantId),
          eq(cameraLinks.cameraId, cameraId),
        ),
      )
      .orderBy(cameraLinks.priority);

    return rows;
  }

  async create(tenantId: string, input: CreateCameraLinkInput) {
    const [row] = await db
      .insert(cameraLinks)
      .values({
        tenantId,
        cameraId: input.cameraId,
        linkedDeviceId: input.linkedDeviceId,
        linkType: input.linkType,
        priority: input.priority,
      })
      .returning();

    return row;
  }

  async remove(tenantId: string, id: string) {
    const [deleted] = await db
      .delete(cameraLinks)
      .where(and(eq(cameraLinks.id, id), eq(cameraLinks.tenantId, tenantId)))
      .returning();

    return deleted ?? null;
  }
}

export const cameraLinksService = new CameraLinksService();
