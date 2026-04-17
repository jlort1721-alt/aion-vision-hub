import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { accessDoorsService } from "./service.js";
import {
  listDoorsQuerySchema,
  openDoorBodySchema,
  doorHistoryQuerySchema,
  type ListDoorsQuery,
  type OpenDoorBody,
  type DoorHistoryQuery,
} from "./schemas.js";

export async function registerAccessDoorsRoutes(app: FastifyInstance) {
  // List doors (optional site filter)
  app.get<{ Querystring: ListDoorsQuery }>(
    "/doors",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const q = listDoorsQuerySchema.parse(request.query);
      const data = await accessDoorsService.listDoors(
        request.tenantId,
        q.site_id,
      );
      return reply.send({ success: true, data, meta: { count: data.length } });
    },
  );

  // Door detail
  app.get<{ Params: { id: string } }>(
    "/doors/:id",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const data = await accessDoorsService.getDoorById(
        request.params.id,
        request.tenantId,
      );
      if (!data)
        return reply
          .code(404)
          .send({ success: false, error: "Door not found" });
      return reply.send({ success: true, data });
    },
  );

  // Open door (remote command)
  app.post<{ Body: OpenDoorBody }>(
    "/doors/open",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const body = openDoorBodySchema.parse(request.body);
      const operatorId =
        request.userId ?? "00000000-0000-0000-0000-000000000000";
      const result = await accessDoorsService.openDoor(
        body.door_id,
        request.tenantId,
        operatorId,
        body.reason,
        body.duration_seconds,
      );
      await request.audit("access.door.open", "access_doors", body.door_id, {
        command_id: result.commandId,
        mode: result.mode,
        reason: body.reason,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // Door history
  app.get<{ Params: { id: string }; Querystring: DoorHistoryQuery }>(
    "/doors/:id/history",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const q = doorHistoryQuerySchema.parse(request.query);
      const data = await accessDoorsService.getHistory(
        request.params.id,
        request.tenantId,
        q.limit,
        q.from,
        q.to,
      );
      return reply.send({ success: true, data, meta: { count: data.length } });
    },
  );
}
