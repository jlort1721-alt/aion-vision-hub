/**
 * Universal Device Control Routes
 *
 * Provides a single endpoint to control ANY device regardless of brand.
 * Uses the Universal Device Protocol to auto-detect and execute commands.
 */

import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import {
  autoDetectDevice,
  executeDeviceCommand,
} from "../../services/universal-device-protocol.js";
import type {
  DeviceConnectionParams,
  DeviceCommand,
} from "../../services/universal-device-protocol.js";
import { db } from "../../db/client.js";
import { devices } from "../../db/schema/index.js";
import { eq, and } from "drizzle-orm";

export async function registerDeviceControlRoutes(app: FastifyInstance) {
  // ── POST /detect — Auto-detect device brand and capabilities ──
  app.post<{ Body: DeviceConnectionParams }>(
    "/detect",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
      schema: {
        tags: ["Device Control"],
        summary: "Auto-detect device brand, model, and capabilities",
      },
    },
    async (request, reply) => {
      const result = await autoDetectDevice(request.body);

      await request.audit("device.detect", "devices", request.body.ip, {
        brand: result.brand,
        model: result.model,
      });

      return reply.send({ success: !result.error, data: result });
    },
  );

  // ── POST /execute — Execute command on device by connection params ──
  app.post<{
    Body: { connection: DeviceConnectionParams; command: DeviceCommand };
  }>(
    "/execute",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
      schema: {
        tags: ["Device Control"],
        summary:
          "Execute command on any device (reboot, snapshot, open_door, ptz, get_info, get_streams)",
      },
    },
    async (request, reply) => {
      const { connection, command } = request.body;

      if (!connection?.ip) {
        return reply
          .code(400)
          .send({ success: false, error: "IP del dispositivo es obligatoria" });
      }

      const result = await executeDeviceCommand(connection, command);

      await request.audit(
        `device.command.${command.action}`,
        "devices",
        connection.ip,
        {
          action: command.action,
          success: result.success,
          latencyMs: result.latencyMs,
        },
      );

      return reply.send({ success: result.success, data: result });
    },
  );

  // ── POST /execute/:deviceId — Execute command on a registered device ──
  app.post<{ Params: { deviceId: string }; Body: DeviceCommand }>(
    "/execute/:deviceId",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
      schema: {
        tags: ["Device Control"],
        summary: "Execute command on a registered device by ID",
      },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const command = request.body;

      // Get device from database
      const [device] = await db
        .select()
        .from(devices)
        .where(
          and(eq(devices.id, deviceId), eq(devices.tenantId, request.tenantId)),
        )
        .limit(1);

      if (!device) {
        return reply
          .code(404)
          .send({ success: false, error: "Dispositivo no encontrado" });
      }

      const connection: DeviceConnectionParams = {
        ip: device.ipAddress || "",
        port: device.port || 80,
        username: device.username || undefined,
        password: device.password || undefined,
        brand: device.brand || undefined,
        model: device.model || undefined,
      };

      const result = await executeDeviceCommand(connection, command);

      await request.audit(
        `device.command.${command.action}`,
        "devices",
        deviceId,
        {
          deviceName: device.name,
          success: result.success,
        },
      );

      return reply.send({ success: result.success, data: result });
    },
  );

  // ── POST /batch — Execute command on multiple devices ──
  app.post<{ Body: { deviceIds: string[]; command: DeviceCommand } }>(
    "/batch",
    {
      preHandler: [requireRole("tenant_admin", "super_admin")],
      schema: {
        tags: ["Device Control"],
        summary: "Execute command on multiple devices simultaneously",
      },
    },
    async (request, reply) => {
      const { deviceIds, command } = request.body;

      if (!deviceIds?.length) {
        return reply.code(400).send({
          success: false,
          error: "Seleccione al menos un dispositivo",
        });
      }

      const results = await Promise.allSettled(
        deviceIds.map(async (id) => {
          const [device] = await db
            .select()
            .from(devices)
            .where(
              and(eq(devices.id, id), eq(devices.tenantId, request.tenantId)),
            )
            .limit(1);

          if (!device)
            return { deviceId: id, success: false, error: "No encontrado" };

          const connection: DeviceConnectionParams = {
            ip: device.ipAddress || "",
            port: device.port || 80,
            username: device.username || undefined,
            password: device.password || undefined,
            brand: device.brand || undefined,
          };

          const result = await executeDeviceCommand(connection, command);
          return { deviceId: id, deviceName: device.name, ...result };
        }),
      );

      const data = results.map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : {
              deviceId: deviceIds[i],
              success: false,
              error: "Error de ejecución",
            },
      );

      const successCount = data.filter((d) => d.success).length;

      await request.audit("device.batch", "devices", "batch", {
        action: command.action,
        total: deviceIds.length,
        success: successCount,
      });

      return reply.send({
        success: true,
        data: {
          total: deviceIds.length,
          success: successCount,
          failed: deviceIds.length - successCount,
          results: data,
        },
      });
    },
  );

  // ── POST /time-sync/:deviceId — Sync device clock to server time ──
  app.post<{ Params: { deviceId: string } }>(
    "/time-sync/:deviceId",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
      schema: {
        tags: ["Device Control"],
        summary: "Synchronize DVR/NVR clock to server UTC time (FX-031)",
      },
    },
    async (request, reply) => {
      const { deviceId } = request.params;

      const [device] = await db
        .select()
        .from(devices)
        .where(
          and(eq(devices.id, deviceId), eq(devices.tenantId, request.tenantId)),
        )
        .limit(1);

      if (!device) {
        return reply
          .code(404)
          .send({ success: false, error: "Dispositivo no encontrado" });
      }

      if (!device.brand || !["hikvision", "dahua"].includes(device.brand)) {
        return reply.code(400).send({
          success: false,
          error: "Solo soportado para dispositivos Hikvision y Dahua",
        });
      }

      const now = new Date();

      let deviceTimeBefore: string | null = null;
      let synced = false;

      try {
        if (device.brand === "hikvision") {
          const { hikvisionISAPI } =
            await import("../../services/hikvision-isapi.js");
          const timeBefore = await hikvisionISAPI.getDeviceTime(
            deviceId,
            request.tenantId,
          );
          deviceTimeBefore = timeBefore?.localTime ?? null;
          synced = await hikvisionISAPI.setDeviceTime(
            deviceId,
            request.tenantId,
            now.toISOString(),
          );
        } else {
          const { dahuaCGI } = await import("../../services/dahua-cgi.js");
          deviceTimeBefore = await dahuaCGI.getDeviceTime(
            deviceId,
            request.tenantId,
          );
          synced = await dahuaCGI.setDeviceTime(
            deviceId,
            request.tenantId,
            now.toISOString(),
          );
        }
      } catch (err) {
        return reply.code(502).send({
          success: false,
          error: `Error de comunicación: ${(err as Error).message}`,
        });
      }

      const driftBeforeSec = deviceTimeBefore
        ? Math.abs(
            (now.getTime() - new Date(deviceTimeBefore).getTime()) / 1000,
          )
        : null;

      await request.audit("device.time_sync", "devices", deviceId, {
        deviceName: device.name,
        brand: device.brand,
        driftBeforeSec:
          driftBeforeSec !== null ? Math.round(driftBeforeSec) : null,
        synced,
      });

      return reply.send({
        success: synced,
        data: {
          deviceId,
          deviceName: device.name,
          brand: device.brand,
          driftBeforeSec:
            driftBeforeSec !== null ? Math.round(driftBeforeSec) : null,
          syncedAt: synced ? now.toISOString() : null,
        },
      });
    },
  );
}
