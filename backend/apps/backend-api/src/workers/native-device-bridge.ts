/**
 * Native Device Bridge Worker
 *
 * Polls devices in reverse.devices via HTTP (ISAPI for Hikvision, CGI for Dahua)
 * and maintains heartbeats in reverse.sessions + streams in go2rtc.
 *
 * Replaces the need for proprietary SDKs (HCNetSDK / NetSDK) by using
 * the vendor-official HTTP APIs that every DVR/NVR exposes on port 80.
 *
 * Run via PM2:
 *   pm2 start dist/workers/native-device-bridge.js --name native-device-bridge
 */
import "dotenv/config";
import pg from "pg";

const GO2RTC_URL = process.env.GO2RTC_URL || "http://localhost:1984";
const PG_DSN =
  process.env.DATABASE_URL ||
  "postgresql://aionseg:A10n_Pr0d_2026@127.0.0.1:5432/aionseg_prod";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "30000", 10);
const STREAM_PREFIX = process.env.STREAM_PREFIX || "aion_";
const MAX_CONCURRENT = 8;

// Simple structured logger
const log = {
  info: (...args: unknown[]) =>
    console.log(
      JSON.stringify({
        level: "info",
        time: new Date().toISOString(),
        svc: "native-device-bridge",
        msg: args.map(String).join(" "),
      }),
    ),
  warn: (...args: unknown[]) =>
    console.warn(
      JSON.stringify({
        level: "warn",
        time: new Date().toISOString(),
        svc: "native-device-bridge",
        msg: args.map(String).join(" "),
      }),
    ),
  error: (...args: unknown[]) =>
    console.error(
      JSON.stringify({
        level: "error",
        time: new Date().toISOString(),
        svc: "native-device-bridge",
        msg: args.map(String).join(" "),
      }),
    ),
};

// ── Types ──

interface DeviceRow {
  id: string;
  vendor: string;
  device_id: string;
  display_name: string;
  channel_count: number;
  status: string;
  metadata: Record<string, unknown>;
}

interface ProbeResult {
  ok: boolean;
  vendor?: string;
  model?: string;
  firmware?: string;
  channels?: number;
  method?: string;
  error?: string;
}

// ── Device Credentials ──

interface DeviceCreds {
  user: string;
  pass: string;
}

const DEVICE_CREDS: Record<string, DeviceCreds> = {};

const DEFAULT_CREDS: Record<string, DeviceCreds[]> = {
  hikvision: [
    { user: "admin", pass: "Clave.seg2023" },
    { user: "admin", pass: "seg12345" },
    { user: "admin", pass: "12345" },
  ],
  dahua: [
    { user: "admin", pass: "Clave.seg2023" },
    { user: "admin", pass: "admin" },
    { user: "admin", pass: "admin123" },
  ],
};

// ── HTTP Digest Auth ──

import { createHash, randomBytes } from "crypto";

function md5(data: string): string {
  return createHash("md5").update(data).digest("hex");
}

interface DigestParams {
  realm: string;
  nonce: string;
  qop?: string;
  algorithm?: string;
  opaque?: string;
}

function parseWWWAuthenticate(header: string): DigestParams | null {
  if (!header.toLowerCase().startsWith("digest ")) return null;
  const parts = header.slice(7);
  const get = (key: string): string | undefined => {
    const m = parts.match(new RegExp(`${key}="?([^",]+)"?`));
    return m?.[1];
  };
  const realm = get("realm");
  const nonce = get("nonce");
  if (!realm || !nonce) return null;
  return {
    realm,
    nonce,
    qop: get("qop"),
    algorithm: get("algorithm"),
    opaque: get("opaque"),
  };
}

function buildDigestAuth(
  params: DigestParams,
  method: string,
  uri: string,
  username: string,
  password: string,
  nc: number,
): string {
  const cnonce = randomBytes(8).toString("hex");
  const ncStr = nc.toString(16).padStart(8, "0");

  const ha1 = md5(`${username}:${params.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let response: string;
  if (params.qop === "auth") {
    response = md5(`${ha1}:${params.nonce}:${ncStr}:${cnonce}:auth:${ha2}`);
  } else {
    response = md5(`${ha1}:${params.nonce}:${ha2}`);
  }

  let header = `Digest username="${username}", realm="${params.realm}", nonce="${params.nonce}", uri="${uri}", response="${response}"`;
  if (params.qop === "auth") {
    header += `, qop=auth, nc=${ncStr}, cnonce="${cnonce}"`;
  }
  if (params.opaque) {
    header += `, opaque="${params.opaque}"`;
  }
  return header;
}

// ── HTTP Client with Digest ──

async function httpGetWithDigest(
  url: string,
  user: string,
  pass: string,
  timeoutMs = 5000,
): Promise<{ status: number; body: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // First request without auth
    const resp1 = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/xml, text/plain, */*" },
    });

    if (resp1.status !== 401) {
      const body = await resp1.text();
      clearTimeout(timer);
      return { status: resp1.status, body };
    }

    // Parse digest challenge
    const wwwAuth = resp1.headers.get("www-authenticate") || "";
    const params = parseWWWAuthenticate(wwwAuth);
    if (!params) {
      clearTimeout(timer);
      return null;
    }

    // Build auth header and retry
    const parsed = new URL(url);
    const uri = parsed.pathname + parsed.search;
    const authHeader = buildDigestAuth(params, "GET", uri, user, pass, 1);

    const resp2 = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: authHeader,
        Accept: "application/xml, text/plain, */*",
      },
    });
    const body = await resp2.text();
    clearTimeout(timer);
    return { status: resp2.status, body };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Device Probers ──

async function probeHikvisionISAPI(
  ip: string,
  port: number,
  user: string,
  pass: string,
): Promise<ProbeResult> {
  const url = `http://${ip}:${port}/ISAPI/System/deviceInfo`;
  const resp = await httpGetWithDigest(url, user, pass);
  if (!resp || resp.status !== 200) {
    return { ok: false, error: `ISAPI ${resp?.status || "timeout"}` };
  }

  const model = resp.body.match(/<model>([^<]+)<\/model>/)?.[1] || "unknown";
  const firmware =
    resp.body.match(/<firmwareVersion>([^<]+)<\/firmwareVersion>/)?.[1] ||
    "unknown";
  const channels = parseInt(
    resp.body.match(/<channelNums>(\d+)<\/channelNums>/)?.[1] || "0",
    10,
  );

  return {
    ok: true,
    vendor: "hikvision",
    model,
    firmware,
    channels: channels || undefined,
    method: "isapi_http",
  };
}

async function probeDahuaCGI(
  ip: string,
  port: number,
  user: string,
  pass: string,
): Promise<ProbeResult> {
  const url = `http://${ip}:${port}/cgi-bin/magicBox.cgi?action=getDeviceType`;
  const resp = await httpGetWithDigest(url, user, pass);
  if (!resp || resp.status !== 200) {
    return { ok: false, error: `CGI ${resp?.status || "timeout"}` };
  }

  const model = resp.body.match(/type=([^\r\n]+)/)?.[1] || "unknown";

  // Get firmware
  const fwResp = await httpGetWithDigest(
    `http://${ip}:${port}/cgi-bin/magicBox.cgi?action=getSoftwareVersion`,
    user,
    pass,
  );
  const firmware = fwResp?.body.match(/version=([^\r\n]+)/)?.[1] || "unknown";

  return {
    ok: true,
    vendor: "dahua",
    model,
    firmware,
    method: "cgi_http",
  };
}

// ── go2rtc Stream Management ──

async function registerStream(name: string, rtspUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(`${GO2RTC_URL}/api/streams`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [name]: { name, source: rtspUrl } }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function buildRtspUrl(
  vendor: string,
  ip: string,
  port: number,
  user: string,
  pass: string,
  channel: number,
  sub = true,
): string {
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`;
  if (vendor === "hikvision") {
    const streamType = sub ? "02" : "01";
    return `rtsp://${auth}@${ip}:${port}/Streaming/Channels/${channel}${streamType}`;
  }
  const subtype = sub ? 1 : 0;
  return `rtsp://${auth}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
}

// ── Database ──

let pool: pg.Pool;

export async function loadDevicesWithHTTP(): Promise<DeviceRow[]> {
  const result = await pool.query(`
    SELECT id, vendor, device_id, display_name, channel_count, status, metadata
    FROM reverse.devices
    WHERE metadata->>'wan_ip' IS NOT NULL
      AND (metadata->>'http_access')::boolean = true
    ORDER BY vendor, device_id
  `);
  return result.rows;
}

async function loadAllDevicesWithIP(): Promise<DeviceRow[]> {
  const result = await pool.query(`
    SELECT id, vendor, device_id, display_name, channel_count, status, metadata
    FROM reverse.devices
    WHERE metadata->>'wan_ip' IS NOT NULL
    ORDER BY vendor, device_id
  `);
  return result.rows;
}

async function upsertSession(
  devicePk: string,
  remoteAddr: string,
  firmware: string,
): Promise<void> {
  void firmware; // used by session query below
  // Check if session exists
  const existing = await pool.query(
    `SELECT id FROM reverse.sessions WHERE device_pk = $1 AND closed_at IS NULL AND firmware = 'native_bridge'`,
    [devicePk],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE reverse.sessions SET last_heartbeat = NOW() WHERE id = $1`,
      [existing.rows[0].id],
    );
  } else {
    await pool.query(
      `INSERT INTO reverse.sessions (device_pk, remote_addr, state, last_heartbeat, firmware, sdk_version)
       VALUES ($1, $2::inet, 'online', NOW(), 'native_bridge', '1.0')`,
      [devicePk, remoteAddr],
    );
  }
}

async function insertHealthCheck(
  routeId: string,
  ok: boolean,
  latencyMs: number,
  error?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO reverse.health_checks (route_id, ok, latency_ms, error)
     VALUES ($1, $2, $3, $4)`,
    [routeId, ok, latencyMs, error || null],
  );
}

async function getIsupNativeRoute(devicePk: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT id FROM reverse.routes WHERE device_pk = $1 AND kind = 'isup_native'`,
    [devicePk],
  );
  return result.rows[0]?.id || null;
}

export async function logAudit(
  action: string,
  target: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO reverse.audit_log (actor, action, target, details) VALUES ($1, $2, $3, $4)`,
      [
        "aion-vh-native-bridge",
        action,
        target,
        details ? JSON.stringify(details) : null,
      ],
    );
  } catch {
    // best-effort
  }
}

// ── Main Poll Loop ──

let running = false;
let cycleNum = 0;

async function pollCycle(): Promise<void> {
  if (running) return;
  running = true;
  cycleNum++;
  const t0 = Date.now();
  let probed = 0;
  let healthy = 0;
  let failed = 0;

  try {
    const devices = await loadAllDevicesWithIP();

    // Process in batches to limit concurrency
    for (let i = 0; i < devices.length; i += MAX_CONCURRENT) {
      const batch = devices.slice(i, i + MAX_CONCURRENT);
      await Promise.allSettled(
        batch.map(async (device) => {
          try {
            await probeDevice(device);
            probed++;
          } catch (err) {
            log.error(
              `probe failed for ${device.device_id}: ${(err as Error).message}`,
            );
            failed++;
          }
        }),
      );
    }

    healthy = await getHealthyCount();
  } catch (err) {
    log.error(`poll cycle error: ${(err as Error).message}`);
  } finally {
    running = false;
    log.info(
      `cycle=${cycleNum} probed=${probed} healthy=${healthy} failed=${failed} elapsed=${Date.now() - t0}ms`,
    );
  }
}

async function probeDevice(device: DeviceRow): Promise<void> {
  const ip = device.metadata.wan_ip as string;
  const httpPort = (device.metadata.http_port as number) || 80;
  const rtspPort = (device.metadata.rtsp_port as number) || 554;
  void device.metadata.http_access; // available for future use

  if (!ip) return;

  // Resolve credentials
  const creds = resolveCredentials(device.device_id, device.vendor);
  if (!creds) {
    return;
  }

  // Try to probe via HTTP
  const t0 = Date.now();
  let result: ProbeResult;

  if (device.vendor === "hikvision") {
    result = await probeHikvisionISAPI(ip, httpPort, creds.user, creds.pass);
  } else if (device.vendor === "dahua") {
    result = await probeDahuaCGI(ip, httpPort, creds.user, creds.pass);
  } else {
    return;
  }

  const latencyMs = Date.now() - t0;

  // Record health check
  const routeId = await getIsupNativeRoute(device.id);
  if (routeId) {
    await insertHealthCheck(routeId, result.ok, latencyMs, result.error);
  }

  if (result.ok) {
    // Update session heartbeat
    await upsertSession(device.id, ip, `native_bridge:${result.method}`);

    // Register RTSP streams in go2rtc
    const channelCount = result.channels || device.channel_count || 1;
    for (let ch = 1; ch <= Math.min(channelCount, 32); ch++) {
      const streamName = `${STREAM_PREFIX}${device.device_id}_ch${ch}`;
      const rtspUrl = buildRtspUrl(
        device.vendor,
        ip,
        rtspPort,
        creds.user,
        creds.pass,
        ch,
        true,
      );
      await registerStream(streamName, rtspUrl);
    }

    // Update device metadata
    if (result.model || result.firmware) {
      await pool.query(
        `UPDATE reverse.devices SET metadata = metadata || $1::jsonb, last_seen_at = NOW() WHERE id = $2`,
        [
          JSON.stringify({
            model: result.model,
            firmware: result.firmware,
            last_probe: new Date().toISOString(),
            probe_method: result.method,
          }),
          device.id,
        ],
      );
    }
  }
}

function resolveCredentials(
  deviceId: string,
  vendor: string,
): DeviceCreds | null {
  // Check per-device creds first
  if (DEVICE_CREDS[deviceId]) return DEVICE_CREDS[deviceId];

  // Use first default for vendor
  const defaults = DEFAULT_CREDS[vendor];
  if (defaults && defaults.length > 0) return defaults[0];

  return null;
}

async function getHealthyCount(): Promise<number> {
  const result = await pool.query(
    `SELECT count(*) FROM reverse.routes WHERE state = 'healthy'`,
  );
  return parseInt(result.rows[0].count, 10);
}

// ── Startup ──

async function main(): Promise<void> {
  log.info("starting native-device-bridge");

  pool = new pg.Pool({ connectionString: PG_DSN, max: 5 });
  await pool.query("SELECT 1");
  log.info("database connected");

  // Load per-device credentials from known snap processes
  DEVICE_CREDS["SSDVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["AGDVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["AGDVR002"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["ARDVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["PQDVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["PQNVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["SCDVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["TLDVR001"] = { user: "admin", pass: "seg12345" };
  DEVICE_CREDS["TLNVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["BRXVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["PPNVR001"] = { user: "admin", pass: "Clave.seg2023" };
  DEVICE_CREDS["PEDVR001"] = { user: "admin", pass: "Clave.seg2023" };

  log.info(`loaded ${Object.keys(DEVICE_CREDS).length} device credentials`);

  // Initial poll
  setTimeout(() => pollCycle(), 5000);

  // Recurring poll
  setInterval(() => pollCycle(), POLL_INTERVAL_MS);

  log.info(`polling every ${POLL_INTERVAL_MS}ms, prefix=${STREAM_PREFIX}`);

  // Graceful shutdown
  const shutdown = async () => {
    log.info("shutting down");
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  log.error(`fatal: ${err.message}`);
  process.exit(1);
});
