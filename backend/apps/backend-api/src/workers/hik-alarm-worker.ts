/**
 * Hikvision SDK Alarm Worker — Standalone process for PM2
 *
 * Subscribes to Redis channel 'aion:hik:alarms' and processes
 * alarm events from the Python hik-bridge microservice.
 *
 * Run via:
 *   pm2 start dist/workers/hik-alarm-worker.js --name hik-alarm-worker
 *
 * Or during development:
 *   npx tsx src/workers/hik-alarm-worker.ts
 */
import "dotenv/config";
import { Redis } from "ioredis";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { events } from "../db/schema/events.js";
import { createLogger } from "@aion/common-utils";

const logger = createLogger({ name: "hik-alarm-worker" });

// ---------------------------------------------------------------------------
// Validate environment
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  logger.fatal(
    "DATABASE_URL is required — set it in .env or PM2 ecosystem config",
  );
  process.exit(1);
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ALARM_CHANNEL = "aion:hik:alarms";
const DEDUP_PREFIX = "dedup:alarm";
const DEDUP_TTL = 10; // seconds

// ---------------------------------------------------------------------------
// Database (singleton — same driver as db/client.ts: postgres.js + drizzle)
// ---------------------------------------------------------------------------

const sql = postgres(process.env.DATABASE_URL, {
  max: 3,
  idle_timeout: 30,
  connect_timeout: 10,
});
const db = drizzle(sql);

// ---------------------------------------------------------------------------
// Redis clients
// ---------------------------------------------------------------------------

let subscriber: Redis | null = null;
let publisher: Redis | null = null;

async function startAlarmListener(): Promise<void> {
  subscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  });
  publisher = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  });

  subscriber.on("error", (err) =>
    logger.error({ err: err.message }, "Redis subscriber error"),
  );
  publisher.on("error", (err) =>
    logger.error({ err: err.message }, "Redis publisher error"),
  );

  // Subscribe to SDK alarm channel
  await subscriber.subscribe(ALARM_CHANNEL);
  logger.info({ channel: ALARM_CHANNEL }, "Subscribed to Redis channel");

  subscriber.on("message", async (channel: string, message: string) => {
    if (channel !== ALARM_CHANNEL) return;

    try {
      const event = JSON.parse(message) as AlarmEvent;
      await processAlarmEvent(event);
    } catch (err) {
      logger.error({ err }, "Failed to process alarm event");
    }
  });
}

// ---------------------------------------------------------------------------
// Event processing
// ---------------------------------------------------------------------------

interface AlarmEvent {
  id: string;
  device_ip: string;
  device_name: string;
  device_id?: string;
  site_id?: string;
  channel: number;
  event_type: string;
  event_time: string;
  event_data: Record<string, unknown>;
  snapshot_path?: string;
  source: string;
}

async function processAlarmEvent(event: AlarmEvent): Promise<void> {
  // Cross-source deduplication (check if ISAPI listener already processed this)
  const dedupKey = `${DEDUP_PREFIX}:${event.device_ip}:${event.channel}:${event.event_type}`;

  if (publisher) {
    const wasSet = await publisher.set(dedupKey, "1", "EX", DEDUP_TTL, "NX");
    if (!wasSet) {
      return;
    }
  }

  logger.info(
    { type: event.event_type, device: event.device_ip, channel: event.channel },
    "SDK alarm event",
  );

  // Insert into events table (skip if missing required FK references)
  if (event.site_id && event.device_id) {
    try {
      await db.insert(events).values({
        tenantId: event.site_id,
        siteId: event.site_id,
        deviceId: event.device_id,
        channel: event.channel,
        eventType: event.event_type,
        severity: getSeverity(event.event_type),
        status: "new",
        title: `${event.event_type} — ${event.device_name || event.device_ip}`,
        description: `SDK alarm: ${event.event_type} on channel ${event.channel}`,
        metadata: {
          source: "hik_sdk",
          channel: event.channel,
          raw_type: event.event_data?.raw_type,
          state: event.event_data?.state,
        },
        snapshotUrl: event.snapshot_path || null,
      });
    } catch (err) {
      logger.error(
        { err, device: event.device_ip },
        "Failed to insert event into database",
      );
    }
  } else {
    logger.warn(
      {
        device: event.device_ip,
        site_id: event.site_id,
        device_id: event.device_id,
      },
      "Alarm missing site_id or device_id — skipping DB insert, broadcasting only",
    );
  }

  // Forward to WebSocket broadcast via Redis pub/sub
  if (publisher) {
    try {
      const wsPayload = JSON.stringify({
        type: "alarm",
        data: {
          id: event.id,
          eventType: event.event_type,
          deviceIp: event.device_ip,
          deviceName: event.device_name,
          channel: event.channel,
          timestamp: event.event_time,
          source: "hik_sdk",
          snapshotPath: event.snapshot_path,
        },
      });
      await publisher.publish("ws:broadcast:events", wsPayload);
    } catch (err) {
      logger.error({ err }, "Failed to broadcast alarm via WebSocket");
    }
  }
}

function getSeverity(eventType: string): string {
  const critical = [
    "intrusion",
    "tamper",
    "video_loss",
    "illegal_access",
    "disk_error",
  ];
  const warning = [
    "motion",
    "line_crossing",
    "region_entrance",
    "region_exit",
    "face_detection",
  ];
  const info = ["lpr_detection", "scene_change", "audio_exception"];

  if (critical.includes(eventType)) return "critical";
  if (warning.includes(eventType)) return "warning";
  if (info.includes(eventType)) return "info";
  return "warning";
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutdown signal received");
  if (subscriber) {
    subscriber.unsubscribe(ALARM_CHANNEL).catch(() => {});
    subscriber.disconnect();
  }
  if (publisher) {
    publisher.disconnect();
  }
  sql.end({ timeout: 3 }).catch(() => {});
  setTimeout(() => process.exit(0), 1_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, "Uncaught exception");
  shutdown("uncaughtException");
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

logger.info("Starting Hikvision SDK Alarm Worker...");
startAlarmListener()
  .then(() => {
    logger.info("Alarm worker is running");
  })
  .catch((err) => {
    logger.fatal({ err }, "Failed to start alarm worker");
    process.exit(1);
  });
