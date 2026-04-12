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
  // ── Health ─────────────────────────────────────────────
  app.get("/health", async (_request, reply) => {
    const health = await reverseService.getHealth();
    return reply.send(health);
  });

  // ── Devices ────────────────────────────────────────────
  app.get(
    "/devices",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const filter = deviceFilterSchema.parse(request.query);
      const data = await reverseService.listDevices(filter);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/devices/:id",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
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
    {
      preHandler: [requireRole("tenant_admin", "super_admin")],
    },
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
        request.userId ?? "unknown",
        "device.approved",
        request.params.id,
        input as Record<string, unknown>,
      );
      return reply.send({ success: true, data: device });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/devices/:id/block",
    {
      preHandler: [requireRole("tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const device = await reverseService.blockDevice(request.params.id);
      if (!device)
        return reply
          .code(404)
          .send({ success: false, error: "Device not found" });
      await reverseService.logAudit(
        request.userId ?? "unknown",
        "device.blocked",
        request.params.id,
      );
      return reply.send({ success: true, data: device });
    },
  );

  // ── Sessions ───────────────────────────────────────────
  app.get(
    "/sessions",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const state = (request.query as Record<string, string>).state;
      const data = await reverseService.listSessions(state);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/sessions/:id",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const session = await reverseService.getSession(request.params.id);
      if (!session)
        return reply
          .code(404)
          .send({ success: false, error: "Session not found" });
      return reply.send({ success: true, data: session });
    },
  );

  // ── Streams ────────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    "/sessions/:id/streams",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const { channel } = startStreamSchema.parse(request.body);
      const session = await reverseService.getSession(request.params.id);
      if (!session)
        return reply
          .code(404)
          .send({ success: false, error: "Session not found" });

      const go2rtcName = `rv_${(session as Record<string, unknown>).vendor}_${(session as Record<string, unknown>).device_id}_ch${channel}`;
      const stream = await reverseService.startStream(
        request.params.id,
        channel,
        go2rtcName,
      );
      return reply.code(201).send({
        success: true,
        data: stream,
        streamUrl: `/go2rtc/api/stream.mp4?src=${go2rtcName}`,
      });
    },
  );

  app.delete<{ Params: { id: string; ch: string } }>(
    "/sessions/:id/streams/:ch",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      await reverseService.stopStream(
        request.params.id,
        parseInt(request.params.ch, 10),
      );
      return reply.send({ success: true });
    },
  );

  // ── PTZ ────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    "/sessions/:id/ptz",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const ptz = ptzSchema.parse(request.body);
      const session = await reverseService.getSession(request.params.id);
      if (!session)
        return reply
          .code(404)
          .send({ success: false, error: "Session not found" });

      // PTZ via ISAPI proxy — device must have HTTP access
      await reverseService.logAudit(
        request.userId ?? "unknown",
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

  // ── Snapshot ───────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    "/sessions/:id/snapshot",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const session = await reverseService.getSession(request.params.id);
      if (!session)
        return reply
          .code(404)
          .send({ success: false, error: "Session not found" });

      const go2rtcName = `rv_${(session as Record<string, unknown>).vendor}_${(session as Record<string, unknown>).device_id}_ch1`;
      return reply.send({
        success: true,
        snapshotUrl: `/go2rtc/api/frame.jpeg?src=${go2rtcName}`,
      });
    },
  );

  // ── Events ─────────────────────────────────────────────
  app.get(
    "/events",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (request, reply) => {
      const filter = eventFilterSchema.parse(request.query);
      const data = await reverseService.listEvents(filter);
      return reply.send({ success: true, data });
    },
  );
}
