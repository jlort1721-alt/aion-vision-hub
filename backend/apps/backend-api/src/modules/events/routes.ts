import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { requireRole } from "../../plugins/auth.js";
import { eventService } from "./service.js";
import { alertEngine } from "../alerts/engine.js";
import { broadcast } from "../../plugins/websocket.js";
import { db } from "../../db/client.js";
import {
  createEventSchema,
  assignEventSchema,
  updateEventStatusSchema,
  eventFiltersSchema,
} from "./schemas.js";
import type {
  CreateEventInput,
  AssignEventInput,
  UpdateEventStatusInput,
  EventFilters,
} from "./schemas.js";

export async function registerEventRoutes(app: FastifyInstance) {
  // ── GET / — List events with filters + pagination ─────────
  app.get<{ Querystring: EventFilters }>(
    "/",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const filters = eventFiltersSchema.parse(request.query);
      const result = await eventService.list(request.tenantId, filters);

      return reply.send({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    },
  );

  // ── GET /density — Event density buckets for sparkline ────
  app.get(
    "/density",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const { camera_id, window_min = "60" } = request.query as Record<
        string,
        string
      >;
      if (!camera_id) {
        return reply
          .status(400)
          .send({ success: false, error: "camera_id required" });
      }

      const windowMinutes = Math.min(
        Math.max(parseInt(window_min, 10) || 60, 1),
        1440,
      );

      const result = await db.execute(sql`
        SELECT
          date_trunc('minute', created_at) AS ts,
          COUNT(*)::int AS count,
          MAX(severity) AS severity_max
        FROM events
        WHERE tenant_id = ${request.tenantId}
          AND device_id = ${camera_id}
          AND created_at >= NOW() - (${windowMinutes} || ' minutes')::interval
        GROUP BY 1
        ORDER BY 1 ASC
      `);

      return reply.send({
        success: true,
        buckets: Array.isArray(result) ? result : [],
      });
    },
  );

  // ── GET /stats — Event statistics by severity & status ────
  // NOTE: Defined before /:id to avoid route collision.
  app.get(
    "/stats",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const { from, to } = request.query as { from?: string; to?: string };
      const data = await eventService.getStats(request.tenantId, from, to);
      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create event (usually from gateway) ─────────
  app.post<{ Body: CreateEventInput }>(
    "/",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const body = createEventSchema.parse(request.body);
      const data = await eventService.create(body, request.tenantId);

      // Broadcast new event to connected WebSocket clients
      broadcast(request.tenantId, "events", { type: "event.new", event: data });

      // Process event through alert engine (non-blocking)
      alertEngine
        .processEvent({
          id: data.id,
          tenantId: request.tenantId,
          deviceId: data.deviceId,
          siteId: data.siteId,
          type: data.eventType,
          severity: data.severity,
          title: data.title,
          description: data.description,
        })
        .catch(() => {
          /* logged internally */
        });

      await request.audit("event.create", "events", data.id, {
        type: data.eventType,
        severity: data.severity,
        deviceId: data.deviceId,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /:id/assign — Assign event to user ─────────────
  app.patch<{ Params: { id: string }; Body: AssignEventInput }>(
    "/:id/assign",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const body = assignEventSchema.parse(request.body);
      const data = await eventService.assign(
        request.params.id,
        body,
        request.tenantId,
      );

      broadcast(request.tenantId, "events", {
        type: "event.assigned",
        event: data,
      });

      await request.audit("event.assign", "events", data.id, {
        assignedTo: body.assignedTo,
      });

      return reply.send({ success: true, data });
    },
  );

  // ── PATCH /:id/status — Change event status ──────────────
  app.patch<{ Params: { id: string }; Body: UpdateEventStatusInput }>(
    "/:id/status",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const body = updateEventStatusSchema.parse(request.body);
      const data = await eventService.updateStatus(
        request.params.id,
        body,
        request.tenantId,
      );

      broadcast(request.tenantId, "events", {
        type: "event.status_changed",
        event: data,
      });

      await request.audit("event.status", "events", data.id, {
        status: body.status,
      });

      return reply.send({ success: true, data });
    },
  );
}
