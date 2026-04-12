import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { sql } from "drizzle-orm";
import { redis } from "../../lib/redis.js";
import { appRegistry } from "../../lib/metrics.js";

const startTime = Date.now();

export async function registerHealthRoutes(app: FastifyInstance) {
  // Basic health check — always returns 200 if the process is alive
  app.get("/", async () => ({
    status: "healthy",
    version: "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  }));

  // Liveness probe — lightweight, confirms the event loop is responsive
  app.get("/liveness", async () => ({
    status: "alive",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    pid: process.pid,
  }));

  // Readiness probe — checks external dependencies (DB, Redis)
  app.get("/ready", async (_request, reply) => {
    const checks: Record<string, "ok" | "fail"> = {};

    // Database check
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = "ok";
    } catch {
      checks.database = "fail";
    }

    // Redis check (optional — missing Redis is not a failure if not configured)
    if (redis) {
      try {
        await redis.ping();
        checks.redis = "ok";
      } catch {
        checks.redis = "fail";
      }
    }

    const allOk = Object.values(checks).every((v) => v === "ok");
    if (!allOk) {
      return reply.code(503).send({
        status: "not_ready",
        checks,
        timestamp: new Date().toISOString(),
      });
    }

    return { status: "ready", checks, timestamp: new Date().toISOString() };
  });

  // Prometheus metrics endpoint — returns app-level custom metrics
  app.get("/metrics", async (_request, reply) => {
    const metrics = await appRegistry.metrics();
    reply.header("Content-Type", appRegistry.contentType);
    return metrics;
  });

  // JSON process metrics (for dashboards that prefer JSON)
  app.get("/metrics/json", async () => ({
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  }));

  // Detailed health — checks all platform services (for UptimeRobot / monitoring)
  app.get("/detailed", async (_request, reply) => {
    const checks: Record<
      string,
      { status: string; latency_ms?: number; detail?: string }
    > = {};
    let allHealthy = true;

    const checkService = async (
      name: string,
      fn: () => Promise<void>,
    ): Promise<void> => {
      const t0 = Date.now();
      try {
        await fn();
        checks[name] = { status: "healthy", latency_ms: Date.now() - t0 };
      } catch (err) {
        checks[name] = {
          status: "unhealthy",
          latency_ms: Date.now() - t0,
          detail: (err as Error).message,
        };
        allHealthy = false;
      }
    };

    const checkTcpPort = (
      host: string,
      port: number,
      timeoutMs = 3000,
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        import("net").then(({ connect }) => {
          const sock = connect(port, host, () => {
            sock.end();
            resolve();
          });
          sock.on("error", reject);
          const timer = setTimeout(() => {
            sock.destroy();
            reject(new Error("timeout"));
          }, timeoutMs);
          sock.on("close", () => clearTimeout(timer));
        });
      });

    // Run all checks in parallel for speed
    await Promise.allSettled([
      checkService("postgresql", async () => {
        await db.execute(sql`SELECT 1`);
      }),

      checkService("redis", async () => {
        if (!redis) throw new Error("Redis not configured");
        await redis.ping();
      }),

      checkService("go2rtc", async () => {
        const GO2RTC = process.env.GO2RTC_URL || "http://localhost:1984";
        const res = await fetch(`${GO2RTC}/api/streams`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const streams = (await res.json()) as Record<string, unknown>;
        checks.go2rtc = {
          ...checks.go2rtc,
          detail: `${Object.keys(streams).length} streams configured`,
        };
      }),

      checkService("mqtt", async () => {
        await checkTcpPort("localhost", 1883);
      }),

      checkService("asterisk", async () => {
        await checkTcpPort("localhost", 5038);
      }),

      checkService("face_recognition", async () => {
        const FACE_URL =
          process.env.FACE_RECOGNITION_URL || "http://localhost:5050";
        const res = await fetch(`${FACE_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }),

      checkService("hik_bridge", async () => {
        const HIK_URL = process.env.HIK_BRIDGE_URL || "http://localhost:8100";
        const res = await fetch(`${HIK_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          connected_devices?: number;
          sdk_initialized?: boolean;
        };
        checks.hik_bridge = {
          ...checks.hik_bridge,
          detail: `${data.connected_devices ?? 0} devices, SDK: ${data.sdk_initialized ? "ok" : "unavailable"}`,
        };
      }),
    ]);

    // Disk check (non-critical)
    try {
      const { execSync } = await import("child_process");
      const dfOutput = execSync("df -P / | tail -1").toString();
      const parts = dfOutput.trim().split(/\s+/);
      const usedPct = parseInt(parts[4]);
      const freePct = 100 - usedPct;
      checks.disk = {
        status:
          freePct < 10 ? "unhealthy" : freePct < 20 ? "warning" : "healthy",
        detail: `${freePct}% free`,
      };
      if (freePct < 10) allHealthy = false;
    } catch {
      /* skip on non-unix */
    }

    // Disk + memory (sync, non-critical)
    try {
      const mem = process.memoryUsage();
      const heapPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
      checks.memory = {
        status: heapPct > 90 ? "warning" : "healthy",
        detail: `heap ${heapPct}% (${Math.round(mem.rss / 1048576)}MB RSS)`,
      };
    } catch {
      /* skip */
    }

    return reply.code(allHealthy ? 200 : 503).send({
      status: allHealthy ? "healthy" : "degraded",
      version: "1.0.0",
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks,
    });
  });
}
