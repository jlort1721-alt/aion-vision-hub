/**
 * ISAPI Alert Stream Listener — Real-time motion/event detection from Hikvision DVR/NVR
 *
 * Maintains persistent HTTP connections to Hikvision devices via
 * GET /ISAPI/Event/notification/alertStream (multipart/mixed, Digest Auth).
 *
 * Parsed events are normalized, deduplicated, severity-classified, and forwarded
 * to the internal wall-sys event processing pipeline.
 *
 * No external dependencies beyond Node.js built-ins (http, https, crypto).
 */
import * as http from 'node:http';
import * as https from 'node:https';
import * as crypto from 'node:crypto';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
// Simple logger (avoid external dependency)
const logger = {
  info: (...args: unknown[]) => console.log(`[isapi-alert]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[isapi-alert]`, ...args),
  error: (...args: unknown[]) => console.error(`[isapi-alert]`, ...args),
  debug: (..._args: unknown[]) => {},
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceRecord {
  id: string;
  name: string;
  ip_address: string;
  port: number;
  username: string;
  password: string;
  tenant_id: string;
  site_id: string;
}

interface ParsedAlert {
  eventType: string;
  channelID: string;
  dateTime: string;
  eventState: string;
}

interface NormalizedEvent {
  deviceId: string;
  deviceName: string;
  tenantId: string;
  siteId: string;
  channelId: string;
  type: string;
  rawType: string;
  severity: 'critical' | 'warning' | 'info';
  state: string;
  timestamp: string;
}

interface ActiveConnection {
  req: http.ClientRequest | null;
  device: DeviceRecord;
  backoffMs: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  destroyed: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALERT_STREAM_PATH = '/ISAPI/Event/notification/alertStream';
const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const DEVICE_REFRESH_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes
const DEDUP_WINDOW_MS = 10_000; // 10 seconds

const EVENT_TYPE_MAP: Record<string, string> = {
  vmd: 'motion',
  videomotiondetection: 'motion',
  fielddetection: 'intrusion',
  linedetection: 'line_crossing',
  tamperdetection: 'tamper',
  videoloss: 'video_loss',
  shelteralarm: 'tamper',
  regionentrance: 'region_entrance',
  regionexiting: 'region_exit',
  unattendedbaggagedetection: 'unattended_object',
  attendedbaggagedetection: 'object_removal',
  facedetection: 'face_detection',
  scenechangedetection: 'scene_change',
};

// ---------------------------------------------------------------------------
// Digest Authentication
// ---------------------------------------------------------------------------

function parseDigestChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  // Match key="value" or key=value (unquoted)
  const regex = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2] ?? match[3];
  }
  return params;
}

function md5(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

function buildDigestHeader(
  method: string,
  uri: string,
  username: string,
  password: string,
  challenge: Record<string, string>,
  nc: number,
): string {
  const realm = challenge.realm ?? '';
  const nonce = challenge.nonce ?? '';
  const qop = challenge.qop ?? 'auth';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const ncHex = nc.toString(16).padStart(8, '0');

  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let response: string;
  if (qop) {
    response = md5(`${ha1}:${nonce}:${ncHex}:${cnonce}:${qop}:${ha2}`);
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
  }

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `algorithm=MD5`,
    `response="${response}"`,
  ];

  if (qop) {
    parts.push(`qop=${qop}`, `nc=${ncHex}`, `cnonce="${cnonce}"`);
  }

  if (challenge.opaque) {
    parts.push(`opaque="${challenge.opaque}"`);
  }

  return `Digest ${parts.join(', ')}`;
}

// ---------------------------------------------------------------------------
// XML Parsing (regex-based, no external deps)
// ---------------------------------------------------------------------------

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
  return match?.[1]?.trim() ?? '';
}

function parseAlertXml(xml: string): ParsedAlert | null {
  if (!xml.includes('EventNotificationAlert')) return null;

  const eventType = extractXmlTag(xml, 'eventType');
  const channelID = extractXmlTag(xml, 'channelID') || extractXmlTag(xml, 'dynChannelID') || '1';
  const dateTime = extractXmlTag(xml, 'dateTime');
  const eventState = extractXmlTag(xml, 'activePostCount') !== '0' ? 'active' : extractXmlTag(xml, 'eventState');

  if (!eventType) return null;

  return { eventType, channelID, dateTime, eventState };
}

// ---------------------------------------------------------------------------
// Event Normalization
// ---------------------------------------------------------------------------

function normalizeEventType(raw: string): string {
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  return EVENT_TYPE_MAP[key] ?? raw.toLowerCase();
}

function classifySeverity(timestamp: string): 'critical' | 'warning' | 'info' {
  let hour: number;
  try {
    const dt = new Date(timestamp);
    hour = dt.getHours();
  } catch {
    hour = new Date().getHours();
  }

  if (hour >= 22 || hour < 6) return 'critical';
  if (hour >= 18) return 'warning';
  return 'info';
}

// ---------------------------------------------------------------------------
// ISAPIAlertListener Class
// ---------------------------------------------------------------------------

export class ISAPIAlertListener {
  private connections = new Map<string, ActiveConnection>();
  private dedupCache = new Map<string, number>(); // key → timestamp
  private deviceRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private ncCounter = 1;

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Alert listener already running');
      return;
    }

    this.running = true;
    logger.info('Starting ISAPI alert stream listener');

    await this.refreshDevices();

    this.deviceRefreshTimer = setInterval(() => {
      this.refreshDevices().catch((err) => {
        logger.error({ err: (err as Error).message }, 'Device refresh failed');
      });
    }, DEVICE_REFRESH_INTERVAL_MS);

    // Periodically clean the dedup cache (every 30s)
    setInterval(() => this.cleanDedupCache(), 30_000);
  }

  stop(): void {
    this.running = false;

    if (this.deviceRefreshTimer) {
      clearInterval(this.deviceRefreshTimer);
      this.deviceRefreshTimer = null;
    }

    for (const [deviceId, conn] of this.connections) {
      conn.destroyed = true;
      if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
      if (conn.req) {
        conn.req.destroy();
        conn.req = null;
      }
      logger.info({ deviceId }, 'Disconnected alert stream');
    }
    this.connections.clear();
    logger.info('ISAPI alert listener stopped');
  }

  // -----------------------------------------------------------------------
  // Device Discovery
  // -----------------------------------------------------------------------

  private async refreshDevices(): Promise<void> {
    const rows = await db.execute(sql`
      SELECT id, name, ip_address, port, username, password, tenant_id, site_id
      FROM devices
      WHERE (
        brand ILIKE '%hikvision%' OR brand ILIKE '%hik%'
        OR type ILIKE '%dvr%' OR type ILIKE '%nvr%'
      )
      AND ip_address IS NOT NULL
      AND status != 'decommissioned'
      ORDER BY name
    `);

    const devices = rows as unknown as DeviceRecord[];
    logger.info({ count: devices.length }, 'Discovered Hikvision devices for alert stream');

    const currentIds = new Set(devices.map((d) => d.id));

    // Remove connections for devices that no longer exist
    for (const [deviceId, conn] of this.connections) {
      if (!currentIds.has(deviceId)) {
        conn.destroyed = true;
        if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
        if (conn.req) conn.req.destroy();
        this.connections.delete(deviceId);
        logger.info({ deviceId }, 'Removed stale device connection');
      }
    }

    // Connect to new devices
    for (const device of devices) {
      if (!this.connections.has(device.id)) {
        this.connectDevice(device);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Connection Management
  // -----------------------------------------------------------------------

  private connectDevice(device: DeviceRecord): void {
    const conn: ActiveConnection = {
      req: null,
      device,
      backoffMs: MIN_BACKOFF_MS,
      reconnectTimer: null,
      destroyed: false,
    };
    this.connections.set(device.id, conn);
    this.openAlertStream(conn);
  }

  private openAlertStream(conn: ActiveConnection): void {
    if (conn.destroyed || !this.running) return;

    const { device } = conn;
    const port = device.port || 80;
    const isSecure = port === 443;

    logger.debug({ deviceId: device.id, deviceName: device.name, ip: device.ip_address, port }, 'Opening alert stream (step 1: get challenge)');

    // Step 1: Send unauthenticated request to get Digest challenge
    const requestModule = isSecure ? https : http;

    const options: http.RequestOptions = {
      hostname: device.ip_address,
      port,
      path: ALERT_STREAM_PATH,
      method: 'GET',
      timeout: 15_000,
      headers: {
        Accept: 'multipart/mixed',
      },
    };

    if (isSecure) {
      (options as https.RequestOptions).rejectUnauthorized = false;
    }

    const challengeReq = requestModule.request(options, (res) => {
      if (res.statusCode === 401 && res.headers['www-authenticate']) {
        // Got Digest challenge — authenticate
        const challenge = parseDigestChallenge(res.headers['www-authenticate']!);
        res.resume(); // drain the response
        this.openAuthenticatedStream(conn, challenge);
      } else if (res.statusCode === 200) {
        // Some devices don't require auth — handle the stream directly
        logger.info({ deviceId: device.id }, 'Alert stream opened (no auth required)');
        conn.backoffMs = MIN_BACKOFF_MS;
        this.handleStream(conn, res);
      } else {
        res.resume();
        logger.warn({ deviceId: device.id, status: res.statusCode }, 'Unexpected response from alert stream');
        this.scheduleReconnect(conn);
      }
    });

    challengeReq.on('error', (err) => {
      logger.warn({ deviceId: device.id, err: err.message }, 'Alert stream connection error (challenge)');
      this.scheduleReconnect(conn);
    });

    challengeReq.on('timeout', () => {
      challengeReq.destroy();
      logger.warn({ deviceId: device.id }, 'Alert stream connection timeout (challenge)');
      this.scheduleReconnect(conn);
    });

    challengeReq.end();
  }

  private openAuthenticatedStream(conn: ActiveConnection, challenge: Record<string, string>): void {
    if (conn.destroyed || !this.running) return;

    const { device } = conn;
    const port = device.port || 80;
    const isSecure = port === 443;
    const username = device.username || 'admin';
    const password = device.password || '';

    const nc = this.ncCounter++;
    const authHeader = buildDigestHeader('GET', ALERT_STREAM_PATH, username, password, challenge, nc);

    const requestModule = isSecure ? https : http;

    const options: http.RequestOptions = {
      hostname: device.ip_address,
      port,
      path: ALERT_STREAM_PATH,
      method: 'GET',
      timeout: 0, // No timeout for long-lived stream
      headers: {
        Accept: 'multipart/mixed',
        Authorization: authHeader,
      },
    };

    if (isSecure) {
      (options as https.RequestOptions).rejectUnauthorized = false;
    }

    const req = requestModule.request(options, (res) => {
      if (res.statusCode === 200) {
        logger.info({ deviceId: device.id, deviceName: device.name }, 'Alert stream opened (authenticated)');
        conn.req = req;
        conn.backoffMs = MIN_BACKOFF_MS;
        this.handleStream(conn, res);
      } else if (res.statusCode === 401) {
        res.resume();
        logger.warn({ deviceId: device.id }, 'Digest auth failed — check credentials');
        this.scheduleReconnect(conn);
      } else {
        res.resume();
        logger.warn({ deviceId: device.id, status: res.statusCode }, 'Alert stream auth request failed');
        this.scheduleReconnect(conn);
      }
    });

    req.on('error', (err) => {
      logger.warn({ deviceId: device.id, err: err.message }, 'Alert stream error');
      this.scheduleReconnect(conn);
    });

    conn.req = req;
    req.end();
  }

  // -----------------------------------------------------------------------
  // Stream Parsing
  // -----------------------------------------------------------------------

  private handleStream(conn: ActiveConnection, res: http.IncomingMessage): void {
    const contentType = res.headers['content-type'] || '';
    let boundary = '';

    // Extract boundary from Content-Type: multipart/mixed; boundary=xxx
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (boundaryMatch) {
      boundary = boundaryMatch[1];
    }

    let buffer = '';

    res.setEncoding('utf8');

    res.on('data', (chunk: string) => {
      buffer += chunk;

      // Split on boundary and process complete parts
      const separator = boundary ? `--${boundary}` : '\r\n\r\n';
      const parts = buffer.split(separator);

      // Keep the last (potentially incomplete) part in buffer
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim() || part.trim() === '--') continue;

        const alert = parseAlertXml(part);
        if (alert) {
          this.processAlert(conn.device, alert);
        }
      }
    });

    res.on('end', () => {
      logger.info({ deviceId: conn.device.id }, 'Alert stream ended');
      this.scheduleReconnect(conn);
    });

    res.on('error', (err) => {
      logger.warn({ deviceId: conn.device.id, err: err.message }, 'Alert stream read error');
      this.scheduleReconnect(conn);
    });
  }

  // -----------------------------------------------------------------------
  // Event Processing
  // -----------------------------------------------------------------------

  private processAlert(device: DeviceRecord, alert: ParsedAlert): void {
    // Deduplicate: skip if same device+channel+type within 10 seconds
    const dedupKey = `${device.id}:${alert.channelID}:${alert.eventType}`;
    const now = Date.now();
    const lastSeen = this.dedupCache.get(dedupKey);

    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      return; // duplicate, skip
    }
    this.dedupCache.set(dedupKey, now);

    // Normalize
    const normalizedType = normalizeEventType(alert.eventType);
    const timestamp = alert.dateTime || new Date().toISOString();
    const severity = classifySeverity(timestamp);

    const event: NormalizedEvent = {
      deviceId: device.id,
      deviceName: device.name,
      tenantId: device.tenant_id,
      siteId: device.site_id,
      channelId: alert.channelID,
      type: normalizedType,
      rawType: alert.eventType,
      severity,
      state: alert.eventState || 'active',
      timestamp,
    };

    logger.info(
      {
        device: device.name,
        type: normalizedType,
        channel: alert.channelID,
        severity,
        state: event.state,
      },
      'ISAPI alert received',
    );

    // Persist to events table and forward to wall-sys pipeline
    this.forwardEvent(event).catch((err) => {
      logger.error({ err: (err as Error).message, deviceId: device.id }, 'Failed to forward alert event');
    });
  }

  private async forwardEvent(event: NormalizedEvent): Promise<void> {
    // Insert into events table
    await db.execute(sql`
      INSERT INTO events (
        device_id, tenant_id, site_id, type, severity,
        channel_id, raw_type, state, metadata, created_at
      ) VALUES (
        ${event.deviceId},
        ${event.tenantId},
        ${event.siteId},
        ${event.type},
        ${event.severity},
        ${event.channelId},
        ${event.rawType},
        ${event.state},
        ${JSON.stringify({
          source: 'isapi_alert_stream',
          deviceName: event.deviceName,
        })}::jsonb,
        ${event.timestamp}::timestamptz
      )
    `);

    // Forward to wall-sys internal endpoint (fire-and-forget)
    try {
      const payload = JSON.stringify(event);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: Number(process.env.PORT) || 3000,
          path: '/api/v1/events/ingest',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'X-Internal-Source': 'isapi-alert-listener',
          },
          timeout: 5_000,
        },
        (res) => {
          res.resume(); // drain
        },
      );
      req.on('error', () => { /* best effort */ });
      req.write(payload);
      req.end();
    } catch {
      // Best effort — event is already persisted to DB
    }
  }

  // -----------------------------------------------------------------------
  // Reconnection with Exponential Backoff
  // -----------------------------------------------------------------------

  private scheduleReconnect(conn: ActiveConnection): void {
    if (conn.destroyed || !this.running) return;

    // Clean up existing request
    if (conn.req) {
      conn.req.destroy();
      conn.req = null;
    }

    const delay = Math.min(conn.backoffMs, MAX_BACKOFF_MS);
    logger.debug(
      { deviceId: conn.device.id, delaySec: (delay / 1000).toFixed(1) },
      'Scheduling reconnect',
    );

    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = null;
      conn.backoffMs = Math.min(conn.backoffMs * 2, MAX_BACKOFF_MS);
      this.openAlertStream(conn);
    }, delay);
  }

  // -----------------------------------------------------------------------
  // Dedup Cache Cleanup
  // -----------------------------------------------------------------------

  private cleanDedupCache(): void {
    const cutoff = Date.now() - DEDUP_WINDOW_MS * 2;
    for (const [key, ts] of this.dedupCache) {
      if (ts < cutoff) this.dedupCache.delete(key);
    }
  }

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------

  getStatus(): {
    running: boolean;
    connections: Array<{ deviceId: string; deviceName: string; connected: boolean }>;
  } {
    const connections = Array.from(this.connections.entries()).map(([id, conn]) => ({
      deviceId: id,
      deviceName: conn.device.name,
      connected: conn.req !== null && !conn.destroyed,
    }));
    return { running: this.running, connections };
  }
}

// ---------------------------------------------------------------------------
// Singleton & Public API
// ---------------------------------------------------------------------------

let listener: ISAPIAlertListener | null = null;

/**
 * Start the ISAPI alert stream listener.
 * Safe to call multiple times — only one instance runs.
 */
export async function startISAPIListener(): Promise<ISAPIAlertListener> {
  if (listener) {
    logger.warn('ISAPI listener already started');
    return listener;
  }

  listener = new ISAPIAlertListener();
  await listener.start();
  return listener;
}

/**
 * Stop the running listener.
 */
export function stopISAPIListener(): void {
  if (listener) {
    listener.stop();
    listener = null;
  }
}

/**
 * Get listener status for health/monitoring endpoints.
 */
export function getISAPIListenerStatus() {
  if (!listener) return { running: false, connections: [] };
  return listener.getStatus();
}
