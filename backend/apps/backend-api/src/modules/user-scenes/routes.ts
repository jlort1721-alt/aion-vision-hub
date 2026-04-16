import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { userScenesService } from "./service.js";
import { createSceneSchema, updateSceneSchema } from "./schemas.js";

export async function registerUserScenesRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const scenes = await userScenesService.list(
        request.tenantId,
        request.userId,
      );
      return reply.send({ success: true, data: scenes });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const scene = await userScenesService.getById(
        request.tenantId,
        request.params.id,
      );
      if (!scene)
        return reply.status(404).send({ success: false, error: "not found" });
      return reply.send({ success: true, data: scene });
    },
  );

  app.post(
    "/",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const body = createSceneSchema.parse(request.body);
      const scene = await userScenesService.create(
        request.tenantId,
        request.userId,
        body,
      );
      await request.audit("user_scene.created", "user_scenes", scene.id, {
        name: body.name,
      });
      return reply.status(201).send({ success: true, data: scene });
    },
  );

  app.put<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const body = updateSceneSchema.parse(request.body);
      const scene = await userScenesService.update(
        request.tenantId,
        request.params.id,
        body,
      );
      if (!scene)
        return reply.status(404).send({ success: false, error: "not found" });
      await request.audit("user_scene.updated", "user_scenes", scene.id, {});
      return reply.send({ success: true, data: scene });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const deleted = await userScenesService.remove(
        request.tenantId,
        request.params.id,
      );
      if (!deleted)
        return reply.status(404).send({ success: false, error: "not found" });
      await request.audit(
        "user_scene.deleted",
        "user_scenes",
        request.params.id,
        {},
      );
      return reply.send({ success: true });
    },
  );
}
