import type { FastifyInstance } from "fastify";
import { visionHubService } from "./service.js";
import {
  vhDeviceFilterSchema,
  vhStartStreamSchema,
  vhEventFilterSchema,
} from "./schemas.js";

export async function registerVisionHubRoutes(app: FastifyInstance) {
  const orchestratorUrl =
    process.env.VH_ORCHESTRATOR_URL ?? "http://127.0.0.1:9580";
  const owlUrl = process.env.VH_OWL_URL ?? "http://127.0.0.1:9540";
  const dhMgrUrl = process.env.VH_DHMGR_URL ?? "http://127.0.0.1:9570";

  // ── Health ──────────────────────────────────────────────────
  app.get("/health", async () => {
    return visionHubService.getHealth();
  });

  // ── Devices with routes ─────────────────────────────────────
  app.get("/devices", async (req) => {
    const filter = vhDeviceFilterSchema.parse(req.query);
    return visionHubService.listDevicesWithRoutes(filter);
  });

  app.get("/devices/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const device = await visionHubService.getDevice(id);
    if (!device) return reply.code(404).send({ error: "not found" });
    return device;
  });

  // ── Route operations ────────────────────────────────────────
  app.post("/devices/:deviceId/route/:kind/promote", async (req, reply) => {
    const { deviceId, kind } = req.params as {
      deviceId: string;
      kind: string;
    };
    const user = (req as any).user;
    const result = await visionHubService.promoteRoute(
      deviceId,
      kind,
      user?.email ?? "system",
    );
    if (!result) return reply.code(404).send({ error: "route not found" });
    return result;
  });

  app.post("/devices/:deviceId/route/:kind/disable", async (req, reply) => {
    const { deviceId, kind } = req.params as {
      deviceId: string;
      kind: string;
    };
    const user = (req as any).user;
    const body = (req.body as { reason?: string }) ?? {};
    const result = await visionHubService.disableRoute(
      deviceId,
      kind,
      user?.email ?? "system",
      body.reason ?? "manual",
    );
    if (!result) return reply.code(404).send({ error: "route not found" });
    return result;
  });

  app.post("/devices/:deviceId/probe", async (req, reply) => {
    try {
      const { deviceId } = req.params as { deviceId: string };
      const res = await fetch(`${orchestratorUrl}/devices/${deviceId}/probe`, {
        method: "POST",
      });
      const data = await res.json();
      return reply.code(res.status).send(data);
    } catch (err: any) {
      return reply
        .code(502)
        .send({ error: "orchestrator unreachable", detail: err.message });
    }
  });

  // ── Stream start/stop (proxy to OWL or dh-p2p-manager) ─────
  app.post("/devices/:id/stream/start", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = vhStartStreamSchema.parse(req.body ?? {});

    try {
      if (body.kind === "gb28181") {
        if (!body.channel_id) {
          return reply
            .code(400)
            .send({ error: "channel_id required for gb28181" });
        }
        const res = await fetch(`${owlUrl}/api/invite`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ device_id: id, channel_id: body.channel_id }),
        });
        return reply.code(res.status).send(await res.json());
      } else {
        const res = await fetch(
          `${dhMgrUrl}/workers/${encodeURIComponent(id)}`,
        );
        return reply.code(res.status).send(await res.json());
      }
    } catch (err: any) {
      return reply
        .code(502)
        .send({ error: "upstream unreachable", detail: err.message });
    }
  });

  app.post("/devices/:id/stream/stop", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = vhStartStreamSchema.parse(req.body ?? {});

    try {
      if (body.kind === "gb28181" && body.channel_id) {
        const res = await fetch(`${owlUrl}/api/bye`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ device_id: id, channel_id: body.channel_id }),
        });
        return reply.code(res.status).send(await res.json());
      }
      return { ok: true };
    } catch (err: any) {
      return reply
        .code(502)
        .send({ error: "upstream unreachable", detail: err.message });
    }
  });

  // ── Events ──────────────────────────────────────────────────
  app.get("/events", async (req) => {
    const filter = vhEventFilterSchema.parse(req.query);
    return visionHubService.listRouteEvents(filter);
  });

  // ── SSE stream for live failover events ─────────────────────
  app.get("/events/stream", async (req, reply) => {
    reply.raw.setHeader("content-type", "text/event-stream");
    reply.raw.setHeader("cache-control", "no-cache");
    reply.raw.setHeader("connection", "keep-alive");
    reply.raw.setHeader("x-accel-buffering", "no");

    try {
      const upstream = await fetch(`${orchestratorUrl}/events/stream`);
      if (!upstream.body) {
        reply.raw.end();
        return;
      }
      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
        }
        reply.raw.end();
      };
      pump();
      req.raw.on("close", () => reader.cancel());
    } catch {
      reply.raw.write("event: error\ndata: orchestrator unreachable\n\n");
      reply.raw.end();
    }

    return new Promise<void>(() => {});
  });
}
