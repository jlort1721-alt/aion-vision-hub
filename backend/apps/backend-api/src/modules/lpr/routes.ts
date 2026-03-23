import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { accessVehicles, accessLogs, devices } from '../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import {
  lprService,
  subscribeLive,
  getCameraConfig,
  setCameraConfig,
  type PlateDetection,
  type DetectionFilters,
  type LprCameraConfig,
} from './service.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

interface LprCameraQuery {
  siteId?: string;
}

interface DetectionParams {
  id: string;
}

interface DeviceParams {
  deviceId: string;
}

interface DetectionActionBody {
  action: 'open_gate' | 'deny' | 'manual_override';
  notes?: string;
  relayDeviceId?: string;
}

interface ConfigureBody {
  detectionZone?: { x: number; y: number; width: number; height: number };
  sensitivity?: number;
  plateFormat?: string;
  relayDeviceId?: string;
  relayType?: 'ewelink' | 'generic';
  relayEndpoint?: string;
  autoOpen?: boolean;
  autoOpenMinConfidence?: number;
}

interface ManualMatchBody {
  plate: string;
}

// ── Route Registration ─────────────────────────────────────────────────────────

export async function registerLprRoutes(app: FastifyInstance) {

  // ── GET /cameras ─────────────────────────────────────────────────────────────
  // List devices configured as LPR cameras (type = 'lpr_camera' OR tagged 'lpr')
  app.get<{ Querystring: LprCameraQuery }>(
    '/cameras',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const conditions = [eq(devices.tenantId, tenantId)];

      if (request.query.siteId) {
        conditions.push(eq(devices.siteId, request.query.siteId));
      }

      const allDevices = await db
        .select()
        .from(devices)
        .where(and(...conditions))
        .orderBy(devices.name);

      // Filter in-app for type = 'lpr_camera' OR tags containing 'lpr'
      const lprCameras = allDevices.filter(
        (d) =>
          d.type === 'lpr_camera' ||
          (Array.isArray(d.tags) && d.tags.includes('lpr')),
      );

      // Attach configuration if present
      const data = lprCameras.map((cam) => ({
        ...cam,
        lprConfig: getCameraConfig(tenantId, cam.id) ?? null,
      }));

      return reply.send({ success: true, data });
    },
  );

  // ── POST /cameras/:deviceId/configure ────────────────────────────────────────
  // Configure a device as an LPR camera
  app.post<{ Params: DeviceParams; Body: ConfigureBody }>(
    '/cameras/:deviceId/configure',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { deviceId } = request.params;
      const tenantId = request.tenantId;

      // Verify device exists and belongs to tenant
      const [device] = await db
        .select()
        .from(devices)
        .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
        .limit(1);

      if (!device) {
        return reply.code(404).send({ success: false, error: 'Device not found' });
      }

      const config: LprCameraConfig = {
        detectionZone: request.body.detectionZone,
        sensitivity: request.body.sensitivity,
        plateFormat: request.body.plateFormat,
        relayDeviceId: request.body.relayDeviceId,
        relayType: request.body.relayType,
        relayEndpoint: request.body.relayEndpoint,
        autoOpen: request.body.autoOpen,
        autoOpenMinConfidence: request.body.autoOpenMinConfidence,
      };

      // Remove undefined keys
      for (const key of Object.keys(config) as Array<keyof LprCameraConfig>) {
        if (config[key] === undefined) delete config[key];
      }

      setCameraConfig(tenantId, deviceId, config);

      // Tag device as 'lpr' if not already
      const currentTags = Array.isArray(device.tags) ? device.tags : [];
      if (!currentTags.includes('lpr')) {
        await db
          .update(devices)
          .set({
            tags: [...currentTags, 'lpr'],
            updatedAt: new Date(),
          })
          .where(eq(devices.id, deviceId));
      }

      await request.audit('lpr.camera.configure', 'devices', deviceId, config as unknown as Record<string, unknown>);

      return reply.send({
        success: true,
        data: {
          deviceId,
          config: getCameraConfig(tenantId, deviceId),
        },
      });
    },
  );

  // ── POST /detections ─────────────────────────────────────────────────────────
  // Receive a plate detection (from edge processing, webhook, or ANPR system)
  app.post<{ Body: PlateDetection }>(
    '/detections',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { plate, confidence, cameraId, imageUrl, timestamp } = request.body;

      if (!plate || typeof plate !== 'string' || plate.trim().length === 0) {
        return reply.code(400).send({ success: false, error: 'plate is required' });
      }
      if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
        return reply.code(400).send({ success: false, error: 'confidence must be a number between 0 and 1' });
      }
      if (!cameraId || typeof cameraId !== 'string') {
        return reply.code(400).send({ success: false, error: 'cameraId is required' });
      }
      if (!timestamp || typeof timestamp !== 'string') {
        return reply.code(400).send({ success: false, error: 'timestamp is required (ISO 8601)' });
      }

      const detection = await lprService.logDetection(
        { plate: plate.trim(), confidence, cameraId, imageUrl, timestamp },
        request.tenantId,
      );

      return reply.code(201).send({ success: true, data: detection });
    },
  );

  // ── GET /detections ──────────────────────────────────────────────────────────
  // List recent detections with filters
  app.get<{ Querystring: DetectionFilters }>(
    '/detections',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters: DetectionFilters = {
        plate: request.query.plate,
        confidence: request.query.confidence ? Number(request.query.confidence) : undefined,
        status: request.query.status,
        from: request.query.from,
        to: request.query.to,
        cameraId: request.query.cameraId,
        limit: request.query.limit ? Number(request.query.limit) : 100,
        offset: request.query.offset ? Number(request.query.offset) : 0,
      };

      const result = lprService.listDetections(request.tenantId, filters);
      return reply.send({ success: true, ...result });
    },
  );

  // ── GET /detections/live ─────────────────────────────────────────────────────
  // Server-Sent Events endpoint for real-time plate detections
  app.get(
    '/detections/live',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Send initial keepalive
      reply.raw.write(':ok\n\n');

      // Heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(':heartbeat\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      const unsubscribe = subscribeLive(tenantId, (detection) => {
        try {
          reply.raw.write(`event: detection\n`);
          reply.raw.write(`data: ${JSON.stringify(detection)}\n\n`);
        } catch {
          // Client disconnected
        }
      });

      // Cleanup on client disconnect
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );

  // ── POST /detections/:id/action ──────────────────────────────────────────────
  // Execute an action on a detection (open gate, deny, manual override)
  app.post<{ Params: DetectionParams; Body: DetectionActionBody }>(
    '/detections/:id/action',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { id } = request.params;
      const { action, notes, relayDeviceId } = request.body;
      const tenantId = request.tenantId;

      if (!action || !['open_gate', 'deny', 'manual_override'].includes(action)) {
        return reply.code(400).send({
          success: false,
          error: 'action must be one of: open_gate, deny, manual_override',
        });
      }

      // Find the detection
      const target = lprService.listDetections(tenantId, { limit: 10_000 }).data.find((d) => d.id === id);

      if (!target) {
        return reply.code(404).send({ success: false, error: 'Detection not found' });
      }

      if (action === 'open_gate') {
        // Determine which relay to use
        const relayId = relayDeviceId ?? getCameraConfig(tenantId, target.cameraId)?.relayDeviceId;
        if (!relayId) {
          return reply.code(400).send({
            success: false,
            error: 'No relay device configured. Provide relayDeviceId or configure the camera.',
          });
        }

        const config = getCameraConfig(tenantId, target.cameraId);
        const result = await lprService.triggerGateAction(relayId, 'open_gate', tenantId, config);

        lprService.updateDetection(tenantId, id, {
          action: 'open_gate',
          status: 'action_taken',
        });

        await request.audit('lpr.detection.open_gate', 'access_logs', id, {
          plate: target.plate,
          relayDeviceId: relayId,
        });

        return reply.send({ success: true, data: { action: 'open_gate', relay: result } });
      }

      if (action === 'deny') {
        lprService.updateDetection(tenantId, id, {
          action: 'denied',
          status: 'action_taken',
        });

        // Log denial in access_logs
        await db.insert(accessLogs).values({
          tenantId,
          personId: target.personId,
          vehicleId: target.vehicleId,
          direction: 'denied',
          method: 'plate',
          notes: JSON.stringify({
            detectionId: id,
            plate: target.plate,
            reason: notes ?? 'Operator denied entry',
            operatorId: request.userId,
          }),
          operatorId: request.userId,
        });

        await request.audit('lpr.detection.deny', 'access_logs', id, { plate: target.plate });

        return reply.send({ success: true, data: { action: 'deny', plate: target.plate } });
      }

      // manual_override
      lprService.updateDetection(tenantId, id, {
        action: 'manual_override',
        status: 'action_taken',
      });

      await db.insert(accessLogs).values({
        tenantId,
        personId: target.personId,
        vehicleId: target.vehicleId,
        direction: 'in',
        method: 'plate',
        notes: JSON.stringify({
          detectionId: id,
          plate: target.plate,
          action: 'manual_override',
          operatorNotes: notes,
          operatorId: request.userId,
        }),
        operatorId: request.userId,
      });

      await request.audit('lpr.detection.manual_override', 'access_logs', id, {
        plate: target.plate,
        notes,
      });

      return reply.send({ success: true, data: { action: 'manual_override', plate: target.plate } });
    },
  );

  // ── GET /matches ─────────────────────────────────────────────────────────────
  // List plate matches against registered vehicles (only matched detections)
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/matches',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const limit = Number(request.query.limit) || 100;
      const offset = Number(request.query.offset) || 0;

      const result = lprService.listDetections(request.tenantId, {
        status: 'matched',
        limit,
        offset,
      });

      // Also include action_taken that were originally matched
      const actionTaken = lprService.listDetections(request.tenantId, {
        status: 'action_taken',
        limit: 1000,
      });

      const allMatches = [
        ...result.data,
        ...actionTaken.data.filter((d) => d.matched),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const paged = allMatches.slice(offset, offset + limit);

      return reply.send({
        success: true,
        data: paged,
        total: allMatches.length,
      });
    },
  );

  // ── POST /match ──────────────────────────────────────────────────────────────
  // Manual plate lookup against registered vehicles
  app.post<{ Body: ManualMatchBody }>(
    '/match',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { plate } = request.body;

      if (!plate || typeof plate !== 'string' || plate.trim().length === 0) {
        return reply.code(400).send({ success: false, error: 'plate is required' });
      }

      const result = await lprService.matchPlate(plate.trim(), request.tenantId);

      return reply.send({
        success: true,
        data: {
          plate: plate.trim(),
          matched: result.matched,
          exact: result.exact,
          distance: result.distance,
          vehicle: result.vehicle
            ? {
                id: result.vehicle.id,
                plate: result.vehicle.plate,
                brand: result.vehicle.brand,
                model: result.vehicle.model,
                color: result.vehicle.color,
                type: result.vehicle.type,
                status: result.vehicle.status,
              }
            : null,
          person: result.person
            ? {
                id: result.person.id,
                fullName: result.person.fullName,
                type: result.person.type,
                unit: result.person.unit,
                phone: result.person.phone,
                status: result.person.status,
                photoUrl: result.person.photoUrl,
              }
            : null,
        },
      });
    },
  );

  // ── GET /stats ───────────────────────────────────────────────────────────────
  // Detection statistics
  app.get(
    '/stats',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const stats = lprService.getStats(request.tenantId);

      // Also fetch total registered vehicles for context
      const [vehicleCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(accessVehicles)
        .where(
          and(
            eq(accessVehicles.tenantId, request.tenantId),
            eq(accessVehicles.status, 'active'),
          ),
        );

      return reply.send({
        success: true,
        data: {
          ...stats,
          registeredVehicles: Number(vehicleCount?.count ?? 0),
          accuracy:
            stats.totalDetections > 0
              ? Math.round((stats.matchedDetections / stats.totalDetections) * 10000) / 100
              : 0,
        },
      });
    },
  );
}
