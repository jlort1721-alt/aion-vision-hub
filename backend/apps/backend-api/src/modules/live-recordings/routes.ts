import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { liveRecordingsService } from "./service.js";
import { startRecordingSchema } from "./schemas.js";

export async function registerLiveRecordingsRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const { camera_id } = request.query as { camera_id?: string };
      const recordings = await liveRecordingsService.list(
        request.tenantId,
        camera_id,
      );
      return reply.send({ success: true, data: recordings });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const rec = await liveRecordingsService.getById(
        request.tenantId,
        request.params.id,
      );
      if (!rec)
        return reply.status(404).send({ success: false, error: "not found" });
      return reply.send({ success: true, data: rec });
    },
  );

  app.post(
    "/start",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const body = startRecordingSchema.parse(request.body);
      const rec = await liveRecordingsService.start(
        request.tenantId,
        request.userId,
        body,
      );
      await request.audit("live_recording.started", "live_recordings", rec.id, {
        cameraId: body.cameraId,
        durationSec: body.durationSec,
      });
      return reply.status(201).send({ success: true, data: rec });
    },
  );
}
