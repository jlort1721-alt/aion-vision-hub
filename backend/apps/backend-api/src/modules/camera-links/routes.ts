import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { cameraLinksService } from "./service.js";
import { createCameraLinkSchema } from "./schemas.js";

export async function registerCameraLinksRoutes(app: FastifyInstance) {
  app.get<{ Params: { cameraId: string } }>(
    "/:cameraId",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const links = await cameraLinksService.listByCamera(
        request.tenantId,
        request.params.cameraId,
      );
      return reply.send({ success: true, data: links });
    },
  );

  app.post(
    "/",
    {
      preHandler: [requireRole("tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const body = createCameraLinkSchema.parse(request.body);
      const link = await cameraLinksService.create(request.tenantId, body);
      await request.audit("camera_link.created", "camera_links", link.id, body);
      return reply.status(201).send({ success: true, data: link });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireRole("tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const deleted = await cameraLinksService.remove(
        request.tenantId,
        request.params.id,
      );
      if (!deleted) {
        return reply.status(404).send({ success: false, error: "not found" });
      }
      await request.audit(
        "camera_link.deleted",
        "camera_links",
        request.params.id,
        {},
      );
      return reply.send({ success: true });
    },
  );
}
