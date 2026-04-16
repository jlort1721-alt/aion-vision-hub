// ============================================================
// AION — Hikvision Bridge Routes (Fastify)
// Proxies requests to the Python hik-bridge microservice
// Pattern: modules/clave-bridge/routes.ts
// ============================================================

import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { createLogger } from "@aion/common-utils";
import * as hikBridge from "./service.js";
import {
  ptzMoveSchema,
  ptzStopSchema,
  ptzPresetSchema,
  recordingSearchSchema,
  recordingDownloadSchema,
  deviceLoginSchema,
  bulkLoginSchema,
  discoveryScanSchema,
} from "./schemas.js";

const logger = createLogger({ name: "hik-bridge" });

export async function registerHikBridgeRoutes(app: FastifyInstance) {
  const authGuard = [requireRole("operator", "tenant_admin", "super_admin")];

  // ═══════════════════════════════════════════
  // Health / Status
  // ═══════════════════════════════════════════

  app.get("/status", { preHandler: authGuard }, async (_request, reply) => {
    const result = await hikBridge.getHealth();
    return reply.send(result);
  });

  app.get("/metrics", { preHandler: authGuard }, async (_request, reply) => {
    const result = await hikBridge.getMetrics();
    return reply.send(result);
  });

  // ═══════════════════════════════════════════
  // Devices
  // ═══════════════════════════════════════════

  app.get("/devices", { preHandler: authGuard }, async (_request, reply) => {
    const result = await hikBridge.listDevices();
    return reply.send(result);
  });

  app.get(
    "/devices/:ip/info",
    { preHandler: authGuard },
    async (request, reply) => {
      const { ip } = request.params as { ip: string };
      const result = await hikBridge.getDeviceInfo(ip);
      return reply.send(result);
    },
  );

  app.get(
    "/devices/:ip/status",
    { preHandler: authGuard },
    async (request, reply) => {
      const { ip } = request.params as { ip: string };
      const result = await hikBridge.getDeviceStatus(ip);
      return reply.send(result);
    },
  );

  app.post(
    "/devices/login",
    { preHandler: authGuard },
    async (request, reply) => {
      const credentials = deviceLoginSchema.parse(request.body);
      const result = await hikBridge.loginDevice(credentials);
      return reply.send(result);
    },
  );

  app.post(
    "/devices/bulk-login",
    { preHandler: authGuard },
    async (request, reply) => {
      const devices = bulkLoginSchema.parse(request.body);
      const result = await hikBridge.bulkLogin(devices);
      return reply.send(result);
    },
  );

  app.delete(
    "/devices/:ip/logout",
    { preHandler: authGuard },
    async (request, reply) => {
      const { ip } = request.params as { ip: string };
      const result = await hikBridge.logoutDevice(ip);
      return reply.send(result);
    },
  );

  app.post(
    "/devices/refresh",
    { preHandler: authGuard },
    async (_request, reply) => {
      const result = await hikBridge.refreshDevices();
      return reply.send(result);
    },
  );

  // ═══════════════════════════════════════════
  // Alarms
  // ═══════════════════════════════════════════

  app.post(
    "/:deviceId/alarms/subscribe",
    { preHandler: authGuard },
    async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };
      const result = await hikBridge.subscribeAlarms(deviceId);
      return reply.send(result);
    },
  );

  app.delete(
    "/:deviceId/alarms/unsubscribe",
    { preHandler: authGuard },
    async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };
      const result = await hikBridge.unsubscribeAlarms(deviceId);
      return reply.send(result);
    },
  );

  app.get(
    "/alarms/subscriptions",
    { preHandler: authGuard },
    async (_request, reply) => {
      const result = await hikBridge.listAlarmSubscriptions();
      return reply.send(result);
    },
  );

  app.get(
    "/alarms/recent",
    { preHandler: authGuard },
    async (request, reply) => {
      const raw = (request.query as { count?: string }).count;
      const count = raw ? parseInt(raw, 10) : 100;
      const result = await hikBridge.getRecentAlarms(
        Number.isNaN(count) ? 100 : Math.min(count, 1000),
      );
      return reply.send(result);
    },
  );

  // ═══════════════════════════════════════════
  // PTZ
  // ═══════════════════════════════════════════

  app.post(
    "/:deviceId/ptz/move",
    { preHandler: authGuard },
    async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };
      const body = ptzMoveSchema.parse(request.body);
      const result = await hikBridge.ptzMove({
        device_ip: deviceId,
        channel: body.channel,
        direction: body.direction,
        speed: body.speed,
      });
      return reply.send(result);
    },
  );

  app.post(
    "/:deviceId/ptz/stop",
    { preHandler: authGuard },
    async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };
      const body = ptzStopSchema.parse(request.body);
      const result = await hikBridge.ptzStop({
        device_ip: deviceId,
        channel: body.channel,
      });
      return reply.send(result);
    },
  );

  app.post(
    "/:deviceId/ptz/preset",
    { preHandler: authGuard },
    async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };
      const body = ptzPresetSchema.parse(request.body);
      const result = await hikBridge.ptzPreset({
        device_ip: deviceId,
        channel: body.channel,
        preset_index: body.preset_index,
        action: body.action,
      });
      return reply.send(result);
    },
  );

  app.get(
    "/:deviceId/ptz/presets",
    { preHandler: authGuard },
    async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string };
      const channel = (request.query as { channel?: string }).channel;
      const result = await hikBridge.getPtzPresets(
        deviceId,
        channel ? parseInt(channel, 10) : 1,
      );
      return reply.send(result);
    },
  );

  // ═══════════════════════════════════════════
  // Snapshots
  // ═══════════════════════════════════════════

  app.post(
    "/:deviceId/snapshot/:channel",
    { preHandler: authGuard },
    async (request, reply) => {
      const { deviceId, channel } = request.params as {
        deviceId: string;
        channel: string;
      };
      const result = await hikBridge.captureSnapshot({
        device_ip: deviceId,
        channel: parseInt(channel, 10),
      });
      return reply.send(result);
    },
  );

  app.get("/snapshots", { preHandler: authGuard }, async (request, reply) => {
    const deviceIp = (request.query as { device_ip?: string }).device_ip;
    const result = await hikBridge.listSnapshots(deviceIp);
    return reply.send(result);
  });

  app.get(
    "/snapshots/:filename",
    { preHandler: authGuard },
    async (request, reply) => {
      const { filename } = request.params as { filename: string };
      const result = await hikBridge.getSnapshotFile(filename);
      if (!result.ok) {
        return reply
          .code(result.status)
          .send({ success: false, error: "Snapshot not found" });
      }
      reply.header(
        "Content-Type",
        result.headers.get("content-type") || "image/jpeg",
      );
      const arrayBuffer = await result.arrayBuffer();
      return reply.send(Buffer.from(arrayBuffer));
    },
  );

  app.delete(
    "/snapshots/:filename",
    { preHandler: authGuard },
    async (request, reply) => {
      const { filename } = request.params as { filename: string };
      const result = await hikBridge.deleteSnapshot(filename);
      return reply.send(result);
    },
  );

  // ═══════════════════════════════════════════
  // Recordings
  // ═══════════════════════════════════════════

  app.post(
    "/recordings/search",
    { preHandler: authGuard },
    async (request, reply) => {
      const params = recordingSearchSchema.parse(request.body);
      const result = await hikBridge.searchRecordings({
        device_ip: params.device_ip,
        channel: params.channel,
        start_time: params.start_time,
        end_time: params.end_time,
        file_type: params.file_type,
      });
      return reply.send(result);
    },
  );

  app.post(
    "/recordings/download",
    { preHandler: authGuard },
    async (request, reply) => {
      const params = recordingDownloadSchema.parse(request.body);
      const result = await hikBridge.startRecordingDownload({
        device_ip: params.device_ip,
        filename: params.filename,
        channel: params.channel,
      });
      return reply.send(result);
    },
  );

  app.get(
    "/recordings/:downloadId/status",
    { preHandler: authGuard },
    async (request, reply) => {
      const { downloadId } = request.params as { downloadId: string };
      const result = await hikBridge.getDownloadStatus(downloadId);
      return reply.send(result);
    },
  );

  app.get(
    "/recordings/:downloadId/file",
    { preHandler: authGuard },
    async (request, reply) => {
      const { downloadId } = request.params as { downloadId: string };
      const result = await hikBridge.getDownloadFile(downloadId);
      if (!result.ok) {
        return reply
          .code(result.status)
          .send({ success: false, error: "Download not ready or not found" });
      }
      const contentType = result.headers.get("content-type") || "video/mp4";
      const contentDisposition = result.headers.get("content-disposition");
      reply.header("Content-Type", contentType);
      if (contentDisposition) {
        reply.header("Content-Disposition", contentDisposition);
      }
      // Convert ReadableStream to Buffer for Fastify compatibility
      const arrayBuffer = await result.arrayBuffer();
      return reply.send(Buffer.from(arrayBuffer));
    },
  );

  app.get(
    "/recordings/downloads",
    { preHandler: authGuard },
    async (_request, reply) => {
      const result = await hikBridge.listDownloads();
      return reply.send(result);
    },
  );

  // ═══════════════════════════════════════════
  // Discovery
  // ═══════════════════════════════════════════

  app.post(
    "/discovery/scan",
    { preHandler: authGuard },
    async (request, reply) => {
      const { timeout } = discoveryScanSchema.parse(request.body || {});
      const result = await hikBridge.scanNetwork(timeout);
      return reply.send(result);
    },
  );

  logger.info("Hikvision Bridge routes registered");
}
