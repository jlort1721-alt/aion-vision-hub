import { db } from "../../db/client.js";
import {
  reverseDevices,
  reverseRoutes,
  reverseRouteEvents,
  reverseP2pWorkers,
  reverseAuditLog,
} from "../../db/schema/index.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { VhDeviceFilter, VhEventFilter } from "./schemas.js";

async function listDevicesWithRoutes(filter: VhDeviceFilter) {
  const devices = await db
    .select()
    .from(reverseDevices)
    .limit(filter.limit)
    .offset(filter.offset);

  const deviceIds = devices.map((d) => d.id);
  if (deviceIds.length === 0) return { items: [], total: 0 };

  const routes = await db
    .select()
    .from(reverseRoutes)
    .where(inArray(reverseRoutes.devicePk, deviceIds));

  const routesByDevice = new Map<string, typeof routes>();
  for (const r of routes) {
    const list = routesByDevice.get(r.devicePk) ?? [];
    list.push(r);
    routesByDevice.set(r.devicePk, list);
  }

  const items = devices.map((d) => ({
    ...d,
    routes: (routesByDevice.get(d.id) ?? []).sort(
      (a, b) => a.priority - b.priority,
    ),
    online_sessions: 0,
  }));

  return { items, total: devices.length };
}

async function getDevice(deviceId: string) {
  const [device] = await db
    .select()
    .from(reverseDevices)
    .where(eq(reverseDevices.id, deviceId))
    .limit(1);

  if (!device) return null;

  const routes = await db
    .select()
    .from(reverseRoutes)
    .where(eq(reverseRoutes.devicePk, device.id));

  return {
    ...device,
    routes: routes.sort((a, b) => a.priority - b.priority),
    online_sessions: 0,
  };
}

async function listRouteEvents(filter: VhEventFilter) {
  return db
    .select()
    .from(reverseRouteEvents)
    .orderBy(desc(reverseRouteEvents.createdAt))
    .limit(filter.limit)
    .offset(filter.offset);
}

async function getHealth() {
  const [routeStats] = await db
    .select({
      total: sql<number>`count(*)`,
      healthy: sql<number>`count(*) filter (where ${reverseRoutes.state} = 'healthy')`,
      degraded: sql<number>`count(*) filter (where ${reverseRoutes.state} = 'degraded')`,
      failed: sql<number>`count(*) filter (where ${reverseRoutes.state} = 'failed')`,
    })
    .from(reverseRoutes);

  const workers = await db.select().from(reverseP2pWorkers);

  return {
    ok: true,
    routes: routeStats ?? { total: 0, healthy: 0, degraded: 0, failed: 0 },
    p2p_workers: workers.length,
    ts: new Date().toISOString(),
  };
}

async function promoteRoute(deviceId: string, kind: string, actor: string) {
  const [route] = await db
    .select()
    .from(reverseRoutes)
    .where(
      and(eq(reverseRoutes.devicePk, deviceId), eq(reverseRoutes.kind, kind)),
    )
    .limit(1);

  if (!route) return null;

  const prevPriority = route.priority;
  const newPriority = Math.max(1, prevPriority - 10);

  await db
    .update(reverseRoutes)
    .set({ priority: newPriority })
    .where(eq(reverseRoutes.id, route.id));

  await db.insert(reverseRouteEvents).values({
    routeId: route.id,
    event: "manual_promote",
    fromState: String(prevPriority),
    toState: String(newPriority),
    details: { actor },
  });

  await logAudit(actor, "promote_route", `${deviceId}/${kind}`);
  return { ok: true, route_id: route.id, new_priority: newPriority };
}

async function disableRoute(
  deviceId: string,
  kind: string,
  actor: string,
  reason: string,
) {
  const [route] = await db
    .select()
    .from(reverseRoutes)
    .where(
      and(eq(reverseRoutes.devicePk, deviceId), eq(reverseRoutes.kind, kind)),
    )
    .limit(1);

  if (!route) return null;

  const prevState = route.state;
  await db
    .update(reverseRoutes)
    .set({ state: "disabled" })
    .where(eq(reverseRoutes.id, route.id));

  await db.insert(reverseRouteEvents).values({
    routeId: route.id,
    event: "manual_disable",
    fromState: prevState,
    toState: "disabled",
    details: { actor, reason },
  });

  await logAudit(actor, "disable_route", `${deviceId}/${kind}`);
  return { ok: true, route_id: route.id };
}

async function logAudit(
  actor: string,
  action: string,
  target?: string,
  details?: Record<string, unknown>,
) {
  await db.insert(reverseAuditLog).values({ actor, action, target, details });
}

export const visionHubService = {
  listDevicesWithRoutes,
  getDevice,
  listRouteEvents,
  getHealth,
  promoteRoute,
  disableRoute,
  logAudit,
};
