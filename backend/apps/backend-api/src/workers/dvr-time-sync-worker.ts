/**
 * DVR Time Sync Worker — Standalone PM2 process
 *
 * Periodically checks all online Hikvision and Dahua DVR/NVR devices and
 * synchronizes their clock when drift exceeds 30 seconds. Results are
 * logged to the audit_logs table.
 *
 * Run via:
 *   pm2 start dist/workers/dvr-time-sync-worker.js --name dvr-time-sync-worker
 *
 * Environment:
 *   DATABASE_URL            — PostgreSQL connection string (required)
 *   TIME_SYNC_INTERVAL_MS   — scan interval in ms (default: 21600000 = 6h)
 *   TIME_SYNC_DRIFT_THRESHOLD_SEC — max allowed drift before sync (default: 30)
 *   TIME_SYNC_TENANT_ID     — default tenant (default: all tenants)
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as dsql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
const INTERVAL_MS = parseInt(
  process.env.TIME_SYNC_INTERVAL_MS || "21600000",
  10,
);
const DRIFT_THRESHOLD = parseInt(
  process.env.TIME_SYNC_DRIFT_THRESHOLD_SEC || "30",
  10,
);
const INITIAL_DELAY_MS = 60_000;

const log = {
  info: (...args: unknown[]) =>
    console.log("[dvr-time-sync]", new Date().toISOString(), ...args),
  warn: (...args: unknown[]) =>
    console.warn("[dvr-time-sync]", new Date().toISOString(), ...args),
  error: (...args: unknown[]) =>
    console.error("[dvr-time-sync]", new Date().toISOString(), ...args),
};

if (!DATABASE_URL) {
  log.error("DATABASE_URL is required");
  process.exit(1);
}

const pgClient = postgres(DATABASE_URL, { max: 3 });
const db = drizzle(pgClient);

interface DeviceRow {
  id: string;
  tenant_id: string;
  name: string;
  ip_address: string;
  port: number;
  http_port: number | null;
  username: string;
  password: string;
  brand: string;
}

async function fetchDevices(): Promise<DeviceRow[]> {
  const rows = await db.execute(dsql`
    SELECT id, tenant_id, name, ip_address, port, http_port, username, password, brand
    FROM devices
    WHERE brand IN ('hikvision', 'dahua')
      AND status = 'online'
      AND ip_address IS NOT NULL
    ORDER BY name
  `);
  return rows as unknown as DeviceRow[];
}

function parseDeviceTime(raw: string): Date | null {
  if (!raw) return null;
  const cleaned = raw.replace(/['"]/g, "").trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

async function syncDevice(device: DeviceRow): Promise<void> {
  const now = new Date();
  let deviceTimeStr: string | null = null;

  try {
    if (device.brand === "hikvision") {
      const resp = await fetch(
        `http://${device.ip_address}:${device.port || 8000}/ISAPI/System/time`,
        {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${device.username}:${device.password}`).toString(
                "base64",
              ),
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!resp.ok) {
        log.warn(`${device.name}: HTTP ${resp.status} on getTime`);
        return;
      }
      const body = await resp.text();
      const match = body.match(/<localTime>(.*?)<\/localTime>/);
      deviceTimeStr = match?.[1] ?? null;
    } else if (device.brand === "dahua") {
      const resp = await fetch(
        `http://${device.ip_address}:${device.http_port || device.port || 80}/cgi-bin/global.cgi?action=getCurrentTime`,
        {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${device.username}:${device.password}`).toString(
                "base64",
              ),
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!resp.ok) {
        log.warn(`${device.name}: HTTP ${resp.status} on getTime`);
        return;
      }
      const body = await resp.text();
      const match = body.match(/result=([\d\s:-]+)/);
      deviceTimeStr = match?.[1]?.trim() ?? null;
    }

    if (!deviceTimeStr) {
      log.warn(`${device.name}: could not parse device time`);
      return;
    }

    const deviceTime = parseDeviceTime(deviceTimeStr);
    if (!deviceTime) {
      log.warn(`${device.name}: invalid device time "${deviceTimeStr}"`);
      return;
    }

    const driftSec = Math.abs((now.getTime() - deviceTime.getTime()) / 1000);
    log.info(`${device.name} (${device.brand}): drift=${driftSec.toFixed(1)}s`);

    if (driftSec > DRIFT_THRESHOLD) {
      log.info(
        `${device.name}: drift ${driftSec.toFixed(0)}s > ${DRIFT_THRESHOLD}s → syncing`,
      );

      const isoNow = now.toISOString();
      let synced = false;

      if (device.brand === "hikvision") {
        const localTime = isoNow.replace("Z", "+00:00");
        const xml = `<?xml version="1.0" encoding="UTF-8"?><Time><timeMode>manual</timeMode><localTime>${localTime}</localTime><timeZone>CST-5:00:00</timeZone></Time>`;
        const resp = await fetch(
          `http://${device.ip_address}:${device.port || 8000}/ISAPI/System/time`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/xml",
              Authorization:
                "Basic " +
                Buffer.from(`${device.username}:${device.password}`).toString(
                  "base64",
                ),
            },
            body: xml,
            signal: AbortSignal.timeout(10_000),
          },
        );
        synced = resp.ok;
      } else if (device.brand === "dahua") {
        const formatted = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}%20${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}`;
        const resp = await fetch(
          `http://${device.ip_address}:${device.http_port || device.port || 80}/cgi-bin/global.cgi?action=setCurrentTime&time=${formatted}`,
          {
            headers: {
              Authorization:
                "Basic " +
                Buffer.from(`${device.username}:${device.password}`).toString(
                  "base64",
                ),
            },
            signal: AbortSignal.timeout(10_000),
          },
        );
        synced = resp.ok;
      }

      await db.execute(dsql`
        INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details)
        VALUES (
          ${device.tenant_id},
          '00000000-0000-0000-0000-000000000000',
          'device.time_sync',
          'devices',
          ${device.id},
          ${JSON.stringify({ device: device.name, brand: device.brand, driftSec: Math.round(driftSec), synced, deviceTime: deviceTimeStr })}::jsonb
        )
      `);

      log.info(
        `${device.name}: sync ${synced ? "OK" : "FAILED"} (drift was ${driftSec.toFixed(0)}s)`,
      );
    }
  } catch (err) {
    log.error(`${device.name}: ${(err as Error).message}`);
  }
}

async function runCycle(): Promise<void> {
  log.info("Starting time sync cycle");
  const devices = await fetchDevices();
  log.info(`Found ${devices.length} online Hikvision/Dahua devices`);

  for (const device of devices) {
    await syncDevice(device);
  }

  log.info("Cycle complete");
}

log.info(
  `DVR Time Sync Worker started. Interval=${INTERVAL_MS}ms, Drift threshold=${DRIFT_THRESHOLD}s`,
);
log.info(`Initial sync in ${INITIAL_DELAY_MS / 1000}s...`);

setTimeout(async () => {
  await runCycle().catch((e) => log.error("Initial cycle failed:", e));
  setInterval(
    () => runCycle().catch((e) => log.error("Cycle failed:", e)),
    INTERVAL_MS,
  );
}, INITIAL_DELAY_MS);
