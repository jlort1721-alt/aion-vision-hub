import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { recordingsService } from "./service.js";
import {
  searchRecordingsSchema,
  playbackParamsSchema,
  type SearchRecordingsInput,
  type PlaybackParamsInput,
} from "./schemas.js";

export async function registerRecordingsRoutes(app: FastifyInstance) {
  // Search available recordings for a device+channel in a time range
  app.get<{ Querystring: SearchRecordingsInput }>(
    "/search",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const q = searchRecordingsSchema.parse(request.query);
      const data = await recordingsService.search(
        q.device_id,
        q.channel,
        q.from,
        q.to,
      );
      return reply.send({ success: true, data, meta: { count: data.length } });
    },
  );

  // Start a playback session and receive a streaming URL (HLS or MP4)
  app.post<{ Body: PlaybackParamsInput }>(
    "/playback",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const body = playbackParamsSchema.parse(request.body);
      const operatorId =
        request.userId ?? "00000000-0000-0000-0000-000000000000";
      const session = await recordingsService.startPlayback(
        body.device_id,
        body.channel,
        body.from,
        body.to,
        body.format,
        request.tenantId,
        operatorId,
      );
      await request.audit(
        "recording.playback.create",
        "devices",
        body.device_id,
        {
          channel: body.channel,
          from: body.from,
          to: body.to,
          format: body.format,
          session_id: session.session_id,
        },
      );
      return reply.send({ success: true, data: session });
    },
  );
}
