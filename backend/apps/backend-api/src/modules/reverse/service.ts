import { sql, eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  reverseDevices,
  reverseSessions,
  reverseStreams,
  reverseEvents,
  reverseAuditLog,
} from "../../db/schema/reverse.js";
import type {
  DeviceFilter,
  ApproveDeviceInput,
  EventFilter,
} from "./schemas.js";

async function listDevices(filter: DeviceFilter) {
  const conds = [];
  if (filter.vendor) conds.push(eq(reverseDevices.vendor, filter.vendor));
  if (filter.status) conds.push(eq(reverseDevices.status, filter.status));
  if (filter.site_id) conds.push(eq(reverseDevices.siteId, filter.site_id));

  const rows = await db
    .select({
      id: reverseDevices.id,
      vendor: reverseDevices.vendor,
      device_id: reverseDevices.deviceId,
      display_name: reverseDevices.displayName,
      status: reverseDevices.status,
      site_id: reverseDevices.siteId,
      channel_count: reverseDevices.channelCount,
      first_seen_at: reverseDevices.firstSeenAt,
      last_seen_at: reverseDevices.lastSeenAt,
      metadata: reverseDevices.metadata,
    })
    .from(reverseDevices)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(reverseDevices.lastSeenAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);

  const [countResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reverseDevices)
    .where(conds.length ? and(...conds) : undefined);

  return {
    items: rows,
    total: countResult?.total ?? 0,
    limit: filter.limit ?? 50,
    offset: filter.offset ?? 0,
  };
}

async function getDevice(id: string) {
  const [device] = await db
    .select()
    .from(reverseDevices)
    .where(eq(reverseDevices.id, id))
    .limit(1);
  return device ?? null;
}

async function approveDevice(id: string, input: ApproveDeviceInput) {
  const [device] = await db
    .update(reverseDevices)
    .set({
      status: "approved",
      displayName: input.display_name ?? undefined,
      siteId: input.site_id ?? undefined,
      channelCount: input.channel_count ?? undefined,
    })
    .where(eq(reverseDevices.id, id))
    .returning();
  return device ?? null;
}

async function blockDevice(id: string) {
  const [device] = await db
    .update(reverseDevices)
    .set({ status: "blocked" })
    .where(eq(reverseDevices.id, id))
    .returning();
  return device ?? null;
}

async function listSessions(state?: string) {
  const conds = [];
  if (state) conds.push(eq(reverseSessions.state, state));

  return db
    .select({
      id: reverseSessions.id,
      device_pk: reverseSessions.devicePk,
      remote_addr: reverseSessions.remoteAddr,
      state: reverseSessions.state,
      opened_at: reverseSessions.openedAt,
      closed_at: reverseSessions.closedAt,
      last_heartbeat: reverseSessions.lastHeartbeat,
      firmware: reverseSessions.firmware,
      vendor: reverseDevices.vendor,
      device_id: reverseDevices.deviceId,
      display_name: reverseDevices.displayName,
      channel_count: reverseDevices.channelCount,
    })
    .from(reverseSessions)
    .innerJoin(reverseDevices, eq(reverseDevices.id, reverseSessions.devicePk))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(reverseSessions.openedAt));
}

async function getSession(id: string) {
  const [session] = await db
    .select({
      id: reverseSessions.id,
      device_pk: reverseSessions.devicePk,
      remote_addr: reverseSessions.remoteAddr,
      state: reverseSessions.state,
      opened_at: reverseSessions.openedAt,
      last_heartbeat: reverseSessions.lastHeartbeat,
      firmware: reverseSessions.firmware,
      capabilities: reverseSessions.capabilities,
      vendor: reverseDevices.vendor,
      device_id: reverseDevices.deviceId,
      display_name: reverseDevices.displayName,
      channel_count: reverseDevices.channelCount,
    })
    .from(reverseSessions)
    .innerJoin(reverseDevices, eq(reverseDevices.id, reverseSessions.devicePk))
    .where(eq(reverseSessions.id, id))
    .limit(1);
  return session ?? null;
}

async function startStream(
  sessionId: string,
  channel: number,
  go2rtcName: string,
) {
  const [stream] = await db
    .insert(reverseStreams)
    .values({ sessionId, channel, go2rtcName })
    .onConflictDoNothing()
    .returning();
  return stream ?? null;
}

async function stopStream(sessionId: string, channel: number) {
  await db
    .update(reverseStreams)
    .set({ stoppedAt: new Date() })
    .where(
      and(
        eq(reverseStreams.sessionId, sessionId),
        eq(reverseStreams.channel, channel),
        sql`${reverseStreams.stoppedAt} IS NULL`,
      ),
    );
}

async function listEvents(filter: EventFilter) {
  const conds = [];
  if (filter.device_id)
    conds.push(eq(reverseEvents.devicePk, filter.device_id));
  if (filter.kind) conds.push(eq(reverseEvents.kind, filter.kind));
  if (filter.from)
    conds.push(gte(reverseEvents.createdAt, new Date(filter.from)));
  if (filter.to) conds.push(lte(reverseEvents.createdAt, new Date(filter.to)));

  return db
    .select()
    .from(reverseEvents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(reverseEvents.createdAt))
    .limit(filter.limit ?? 50);
}

async function getHealth() {
  const [deviceStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      online: sql<number>`count(*) FILTER (WHERE ${reverseDevices.status} = 'online')::int`,
    })
    .from(reverseDevices);

  const [sessionStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      online: sql<number>`count(*) FILTER (WHERE ${reverseSessions.state} = 'online')::int`,
    })
    .from(reverseSessions);

  const [streamStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(reverseStreams)
    .where(sql`${reverseStreams.stoppedAt} IS NULL`);

  return {
    status: "ok",
    devices: {
      total: deviceStats?.total ?? 0,
      online: deviceStats?.online ?? 0,
    },
    sessions: {
      total: sessionStats?.total ?? 0,
      online: sessionStats?.online ?? 0,
    },
    activeStreams: streamStats?.total ?? 0,
    timestamp: new Date().toISOString(),
  };
}

async function logAudit(
  actor: string,
  action: string,
  target?: string,
  details?: Record<string, unknown>,
) {
  await db.insert(reverseAuditLog).values({
    actor,
    action,
    target: target ?? null,
    details: details ?? null,
  });
}

export const reverseService = {
  listDevices,
  getDevice,
  approveDevice,
  blockDevice,
  listSessions,
  getSession,
  startStream,
  stopStream,
  listEvents,
  getHealth,
  logAudit,
};
