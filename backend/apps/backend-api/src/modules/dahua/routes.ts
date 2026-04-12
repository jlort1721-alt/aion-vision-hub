import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { dahuaCGI } from "../../services/dahua-cgi.js";
import { dahuaRegistroMonitor } from "../../services/dahua-registro-monitor.js";
import { dahuaEvents } from "../../services/dahua-event-listener.js";

export async function registerDahuaRoutes(app: FastifyInstance) {
  // ── REGISTRO Status ────────────────────────────────────────────

  app.get(
    "/status",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (_req, reply) => {
      return reply.send({
        success: true,
        data: {
          registro: dahuaRegistroMonitor.getStatus(),
          events: dahuaEvents.getStatus(),
        },
      });
    },
  );

  app.get(
    "/registro/devices",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (_req, reply) => {
      const status = dahuaRegistroMonitor.getStatus();
      return reply.send({ success: true, data: status.devices });
    },
  );

  // ── CGI Device Control ─────────────────────────────────────────

  app.get(
    "/cgi/test-all",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (req, reply) => {
      const data = await dahuaCGI.testAllDevices(req.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.get(
    "/cgi/:deviceId/info",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (req, reply) => {
      const { deviceId } = req.params as { deviceId: string };
      const data = await dahuaCGI.getDeviceInfo(deviceId, req.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.get(
    "/cgi/:deviceId/channels",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (req, reply) => {
      const { deviceId } = req.params as { deviceId: string };
      const data = await dahuaCGI.getChannels(deviceId, req.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.get(
    "/cgi/:deviceId/snapshot/:channel",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (req, reply) => {
      const { deviceId, channel } = req.params as {
        deviceId: string;
        channel: string;
      };
      const buffer = await dahuaCGI.getSnapshot(
        deviceId,
        req.tenantId,
        parseInt(channel, 10),
      );
      if (!buffer)
        return reply
          .code(502)
          .send({ success: false, error: "Snapshot no disponible" });
      return reply.type("image/jpeg").send(buffer);
    },
  );

  app.post(
    "/cgi/:deviceId/ptz",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (req, reply) => {
      const { deviceId } = req.params as { deviceId: string };
      const { channel, direction, speed, preset, action } = req.body as {
        channel?: number;
        direction?: string;
        speed?: number;
        preset?: number;
        action?: string;
      };
      const ch = channel || 1;

      if (action === "stop") {
        const ok = await dahuaCGI.ptzStop(deviceId, req.tenantId, ch);
        return reply.send({ success: ok });
      }
      if (preset !== undefined) {
        const ok = await dahuaCGI.ptzPreset(deviceId, req.tenantId, ch, preset);
        return reply.send({ success: ok });
      }
      if (direction) {
        const ok = await dahuaCGI.ptzMove(
          deviceId,
          req.tenantId,
          ch,
          direction,
          speed,
        );
        return reply.send({ success: ok });
      }
      return reply.code(400).send({
        success: false,
        error: "Proporcione direction, preset, o action=stop",
      });
    },
  );

  app.get(
    "/cgi/:deviceId/hdd",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (req, reply) => {
      const { deviceId } = req.params as { deviceId: string };
      const data = await dahuaCGI.getHDDStatus(deviceId, req.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post(
    "/cgi/:deviceId/reboot",
    {
      preHandler: [requireRole("tenant_admin", "super_admin")],
    },
    async (req, reply) => {
      const { deviceId } = req.params as { deviceId: string };
      const ok = await dahuaCGI.reboot(deviceId, req.tenantId);
      if (ok) await req.audit("dahua.cgi.reboot", "devices", deviceId);
      return reply.send({ success: ok });
    },
  );

  app.get(
    "/cgi/:deviceId/stream-url",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (req, reply) => {
      const { deviceId } = req.params as { deviceId: string };
      const { channel, substream } = req.query as {
        channel?: string;
        substream?: string;
      };
      const url = await dahuaCGI.getStreamUrl(
        deviceId,
        req.tenantId,
        channel ? parseInt(channel, 10) : 1,
        substream !== "false",
      );
      return reply.send({ success: true, data: { url } });
    },
  );
}
