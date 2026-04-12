import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import type {
  DeviceFilter,
  ApproveDeviceInput,
  EventFilter,
} from "./schemas.js";

type Row = Record<string, unknown>;

async function query(q: ReturnType<typeof sql>): Promise<Row[]> {
  const result = await db.execute(q);
  return result as unknown as Row[];
}

async function queryOne(q: ReturnType<typeof sql>): Promise<Row | null> {
  const rows = await query(q);
  return rows[0] ?? null;
}

// ── Devices ──────────────────────────────────────────────

async function listDevices(filter: DeviceFilter) {
  let q = sql`SELECT * FROM reverse.devices WHERE 1=1`;
  if (filter.vendor) q = sql`${q} AND vendor = ${filter.vendor}`;
  if (filter.status) q = sql`${q} AND status = ${filter.status}`;
  if (filter.site_id) q = sql`${q} AND site_id = ${filter.site_id}`;
  q = sql`${q} ORDER BY last_seen_at DESC NULLS LAST`;
  return query(q);
}

async function getDevice(id: string) {
  return queryOne(sql`SELECT * FROM reverse.devices WHERE id = ${id}`);
}

async function approveDevice(id: string, input: ApproveDeviceInput) {
  return queryOne(sql`UPDATE reverse.devices SET
    status = 'approved',
    display_name = COALESCE(${input.display_name ?? null}, display_name),
    site_id = COALESCE(${input.site_id ?? null}, site_id),
    channel_count = COALESCE(${input.channel_count ?? null}, channel_count)
  WHERE id = ${id} RETURNING *`);
}

async function blockDevice(id: string) {
  return queryOne(
    sql`UPDATE reverse.devices SET status = 'blocked' WHERE id = ${id} RETURNING *`,
  );
}

// ── Sessions ─────────────────────────────────────────────

async function listSessions(state?: string) {
  const q = state
    ? sql`SELECT s.*, d.vendor, d.device_id, d.display_name
          FROM reverse.sessions s JOIN reverse.devices d ON s.device_pk = d.id
          WHERE s.state = ${state} ORDER BY s.opened_at DESC`
    : sql`SELECT s.*, d.vendor, d.device_id, d.display_name
          FROM reverse.sessions s JOIN reverse.devices d ON s.device_pk = d.id
          ORDER BY s.opened_at DESC`;
  return query(q);
}

async function getSession(id: string) {
  return queryOne(
    sql`SELECT s.*, d.vendor, d.device_id, d.display_name, d.channel_count
        FROM reverse.sessions s JOIN reverse.devices d ON s.device_pk = d.id
        WHERE s.id = ${id}`,
  );
}

// ── Streams ──────────────────────────────────────────────

async function listStreams(sessionId: string) {
  return query(
    sql`SELECT * FROM reverse.streams WHERE session_id = ${sessionId} AND stopped_at IS NULL ORDER BY channel`,
  );
}

async function startStream(
  sessionId: string,
  channel: number,
  go2rtcName: string,
) {
  return queryOne(
    sql`INSERT INTO reverse.streams (session_id, channel, go2rtc_name)
        VALUES (${sessionId}, ${channel}, ${go2rtcName})
        ON CONFLICT DO NOTHING RETURNING *`,
  );
}

async function stopStream(sessionId: string, channel: number) {
  await db.execute(
    sql`UPDATE reverse.streams SET stopped_at = now()
        WHERE session_id = ${sessionId} AND channel = ${channel} AND stopped_at IS NULL`,
  );
}

// ── Events ───────────────────────────────────────────────

async function listEvents(filter: EventFilter) {
  let q = sql`SELECT e.*, d.display_name, d.vendor FROM reverse.events e
              JOIN reverse.devices d ON e.device_pk = d.id WHERE 1=1`;
  if (filter.device_id) q = sql`${q} AND e.device_pk = ${filter.device_id}`;
  if (filter.kind) q = sql`${q} AND e.kind = ${filter.kind}`;
  if (filter.from) q = sql`${q} AND e.created_at >= ${filter.from}`;
  if (filter.to) q = sql`${q} AND e.created_at <= ${filter.to}`;
  q = sql`${q} ORDER BY e.created_at DESC LIMIT ${filter.limit}`;
  return query(q);
}

// ── Health ───────────────────────────────────────────────

async function getHealth() {
  const devices = await queryOne(
    sql`SELECT count(*) as total, count(*) FILTER (WHERE status = 'online') as online FROM reverse.devices`,
  );
  const sessions = await queryOne(
    sql`SELECT count(*) as total, count(*) FILTER (WHERE state = 'online') as online FROM reverse.sessions`,
  );
  const streams = await queryOne(
    sql`SELECT count(*) as total FROM reverse.streams WHERE stopped_at IS NULL`,
  );

  return {
    status: "ok",
    devices: {
      total: Number(devices?.total ?? 0),
      online: Number(devices?.online ?? 0),
    },
    sessions: {
      total: Number(sessions?.total ?? 0),
      online: Number(sessions?.online ?? 0),
    },
    activeStreams: Number(streams?.total ?? 0),
    timestamp: new Date().toISOString(),
  };
}

// ── Audit ────────────────────────────────────────────────

async function logAudit(
  actor: string,
  action: string,
  target?: string,
  details?: Record<string, unknown>,
) {
  await db.execute(
    sql`INSERT INTO reverse.audit_log (actor, action, target, details)
        VALUES (${actor}, ${action}, ${target ?? null}, ${JSON.stringify(details ?? {})}::jsonb)`,
  );
}

export const reverseService = {
  listDevices,
  getDevice,
  approveDevice,
  blockDevice,
  listSessions,
  getSession,
  listStreams,
  startStream,
  stopStream,
  listEvents,
  getHealth,
  logAudit,
};
