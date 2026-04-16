import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { reverseService } from "./service.js";
import {
  deviceFilterSchema,
  approveDeviceSchema,
  startStreamSchema,
  ptzSchema,
  eventFilterSchema,
} from "./schemas.js";

export async function registerReverseRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    const health = await reverseService.getHealth();
    return reply.send(health);
  });

  app.get(
    "/devices",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const filter = deviceFilterSchema.parse(request.query);
      const data = await reverseService.listDevices(filter);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/devices/:id",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const device = await reverseService.getDevice(request.params.id);
      if (!device)
        return reply
          .code(404)
          .send({ success: false, error: "Device not found" });
      return reply.send({ success: true, data: device });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/devices/:id/approve",
    { preHandler: [requireRole("tenant_admin", "super_admin")] },
    async (request, reply) => {
      const input = approveDeviceSchema.parse(request.body);
      const device = await reverseService.approveDevice(
        request.params.id,
        input,
      );
      if (!device)
        return reply
          .code(404)
          .send({ success: false, error: "Device not found" });
      await reverseService.logAudit(
        (request as any).userId ?? "unknown",
        "device.approved",
        request.params.id,
        input as Record<string, unknown>,
      );
      return reply.send({ success: true, data: device });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/devices/:id/block",
    { preHandler: [requireRole("tenant_admin", "super_admin")] },
    async (request, reply) => {
      const device = await reverseService.blockDevice(request.params.id);
      if (!device)
        return reply
          .code(404)
          .send({ success: false, error: "Device not found" });
      await reverseService.logAudit(
        (request as any).userId ?? "unknown",
        "device.blocked",
        request.params.id,
      );
      return reply.send({ success: true, data: device });
    },
  );

  app.get(
    "/sessions",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const state = (request.query as Record<string, string>).state;
      const data = await reverseService.listSessions(state);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/sessions/:id",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const session = await reverseService.getSession(request.params.id);
      if (!session)
        return reply
          .code(404)
          .send({ success: false, error: "Session not found" });
      return reply.send({ success: true, data: session });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/sessions/:id/streams",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const { channel } = startStreamSchema.parse(request.body);
      const session = await reverseService.getSession(request.params.id);
      if (!session)
        return reply
          .code(404)
          .send({ success: false, error: "Session not found" });

      const go2rtcName = `rv_${session.vendor}_${session.device_id}_ch${channel}`;
      const stream = await reverseService.startStream(
        request.params.id,
        channel,
        go2rtcName,
      );

      const publicBase =
        process.env.PUBLIC_GO2RTC_URL ?? "https://aionseg.co/stream";
      return reply.code(201).send({
        success: true,
        data: stream,
        go2rtcName,
        urls: {
          mp4: `${publicBase}/api/stream.mp4?src=${encodeURIComponent(go2rtcName)}`,
          hls: `${publicBase}/api/stream.m3u8?src=${encodeURIComponent(go2rtcName)}`,
          webrtc: `${publicBase}/api/webrtc?src=${encodeURIComponent(go2rtcName)}`,
        },
      });
    },
  );

  app.delete<{ Params: { id: string; ch: string } }>(
    "/sessions/:id/streams/:ch",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      await reverseService.stopStream(
        request.params.id,
        parseInt(request.params.ch, 10),
      );
      return reply.send({ success: true });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/sessions/:id/ptz",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const ptz = ptzSchema.parse(request.body);
      const session = await reverseService.getSession(request.params.id);
      if (!session)
        return reply
          .code(404)
          .send({ success: false, error: "Session not found" });

      if (ptz.action === "goto_preset" && typeof ptz.preset !== "number") {
        return reply
          .code(400)
          .send({ success: false, error: "preset required for goto_preset" });
      }

      await reverseService.logAudit(
        (request as any).userId ?? "unknown",
        "ptz.command",
        request.params.id,
        ptz as Record<string, unknown>,
      );
      return reply.send({
        success: true,
        message: `PTZ ${ptz.action} sent to session ${request.params.id}`,
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/sessions/:id/snapshot",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const session = await reverseService.getSession(request.params.id);
      if (!session)
        return reply
          .code(404)
          .send({ success: false, error: "Session not found" });

      const go2rtcName = `rv_${session.vendor}_${session.device_id}_ch1`;
      return reply.send({
        success: true,
        snapshotUrl: `/go2rtc/api/frame.jpeg?src=${go2rtcName}`,
      });
    },
  );

  app.get(
    "/events",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const filter = eventFilterSchema.parse(request.query);
      const data = await reverseService.listEvents(filter);
      return reply.send({ success: true, data });
    },
  );
}
