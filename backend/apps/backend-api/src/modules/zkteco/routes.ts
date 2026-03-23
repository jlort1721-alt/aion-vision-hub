/**
 * ZKTeco Access-Control Device Routes
 *
 * Provides REST endpoints for pairing, managing, and interacting with
 * ZKTeco InBio / ProBio controllers. Also exposes a public webhook
 * endpoint that devices POST real-time events to.
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { devices, accessPeople, accessLogs } from '../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { zktecoService } from '../../services/zkteco.js';
import type { ZKPushEvent } from '../../services/zkteco.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ZKTECO_BRAND = 'zkteco';
const DEVICE_TYPE = 'access_panel';

/** Build the public webhook callback URL the ZKTeco device should POST to. */
function webhookCallbackUrl(request: { protocol: string; hostname: string }): string {
  const base = process.env['PUBLIC_API_URL']
    ?? `${request.protocol}://${request.hostname}`;
  return `${base}/zkteco/webhook/zkteco`;
}

/** Map ZKTeco verifyMode integer to a human-readable method string. */
function verifyModeToMethod(mode: number): string {
  const map: Record<number, string> = {
    0: 'password',
    1: 'fingerprint',
    2: 'card',
    3: 'password+fingerprint',
    4: 'password+card',
    5: 'fingerprint+card',
    6: 'multi-credential',
    9: 'face',
    15: 'face+fingerprint',
  };
  return map[mode] ?? 'unknown';
}

// ── Route Registration ───────────────────────────────────────────────────────

export async function registerZktecoRoutes(app: FastifyInstance) {
  // ────────────────────────────────────────────────────────────────────────────
  // POST /devices/pair — Pair a new ZKTeco device
  // ────────────────────────────────────────────────────────────────────────────
  app.post<{
    Body: { ip: string; port?: number; name: string; siteId: string };
  }>(
    '/devices/pair',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { ip, port, name, siteId } = request.body;

      if (!ip || !name || !siteId) {
        return reply.code(400).send({ success: false, error: 'ip, name and siteId are required' });
      }

      // 1. Test connection to the device
      const connResult = await zktecoService.connectDevice(ip, port ?? 80);
      if (!connResult.connected) {
        return reply.code(502).send({
          success: false,
          error: `Cannot reach device at ${ip}: ${connResult.error}`,
        });
      }

      // 2. Get full device info
      let deviceInfo;
      try {
        deviceInfo = await zktecoService.getDeviceInfo(ip, port);
      } catch {
        deviceInfo = {
          serialNumber: connResult.serialNumber ?? '',
          model: connResult.model ?? '',
          firmwareVersion: '',
        };
      }

      // 3. Check for duplicate serial number within tenant
      if (deviceInfo.serialNumber) {
        const [existing] = await db
          .select({ id: devices.id })
          .from(devices)
          .where(
            and(
              eq(devices.tenantId, request.tenantId),
              eq(devices.serialNumber, deviceInfo.serialNumber),
            ),
          )
          .limit(1);

        if (existing) {
          return reply.code(409).send({
            success: false,
            error: `Device with serial ${deviceInfo.serialNumber} is already paired`,
            deviceId: existing.id,
          });
        }
      }

      // 4. Persist device
      const [device] = await db
        .insert(devices)
        .values({
          tenantId: request.tenantId,
          siteId,
          name,
          type: DEVICE_TYPE,
          brand: ZKTECO_BRAND,
          model: deviceInfo.model,
          ipAddress: ip,
          port: port ?? 80,
          serialNumber: deviceInfo.serialNumber,
          firmwareVersion: deviceInfo.firmwareVersion,
          status: 'online',
          capabilities: {
            doors: (deviceInfo as any).doorCount ?? 1,
            readers: (deviceInfo as any).readerCount ?? 2,
            pushEvents: true,
          },
          lastSeen: new Date(),
        })
        .returning();

      // 5. Configure push events back to our webhook
      try {
        const cbUrl = webhookCallbackUrl(request);
        await zktecoService.enablePushEvents(ip, cbUrl, port);
      } catch (pushErr) {
        app.log.warn({ err: pushErr, deviceId: device.id }, 'Failed to enable push events on device; device paired but push is inactive');
      }

      await request.audit('zkteco.device.pair', 'devices', device.id, {
        ip,
        serialNumber: deviceInfo.serialNumber,
        model: deviceInfo.model,
      });

      return reply.code(201).send({ success: true, data: device });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // GET /devices — List paired ZKTeco devices with live status
  // ────────────────────────────────────────────────────────────────────────────
  app.get(
    '/devices',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const rows = await db
        .select()
        .from(devices)
        .where(
          and(
            eq(devices.tenantId, request.tenantId),
            eq(devices.brand, ZKTECO_BRAND),
          ),
        )
        .orderBy(devices.name);

      return reply.send({ success: true, data: rows });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // GET /devices/:id/test — Test connectivity to a paired device
  // ────────────────────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/devices/:id/test',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const device = await getDeviceOrFail(request.params.id, request.tenantId);
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      const result = await zktecoService.testConnection(device.ipAddress!, device.port ?? undefined);

      // Update last-seen if reachable
      if (result.reachable) {
        await db
          .update(devices)
          .set({ status: 'online', lastSeen: new Date(), updatedAt: new Date() })
          .where(eq(devices.id, device.id));
      } else {
        await db
          .update(devices)
          .set({ status: 'offline', updatedAt: new Date() })
          .where(eq(devices.id, device.id));
      }

      return reply.send({ success: true, data: result });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // POST /devices/:id/open-door — Trigger door relay
  // ────────────────────────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { doorId?: number; duration?: number };
  }>(
    '/devices/:id/open-door',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const device = await getDeviceOrFail(request.params.id, request.tenantId);
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      const doorId = request.body?.doorId ?? 1;
      const duration = request.body?.duration ?? 5;

      if (doorId < 1 || doorId > 4) {
        return reply.code(400).send({ success: false, error: 'doorId must be between 1 and 4' });
      }
      if (duration < 1 || duration > 60) {
        return reply.code(400).send({ success: false, error: 'duration must be between 1 and 60 seconds' });
      }

      const ok = await zktecoService.openDoor(device.ipAddress!, doorId, duration, device.port ?? undefined);

      await request.audit('zkteco.door.open', 'devices', device.id, { doorId, duration });

      return reply.send({ success: true, data: { opened: ok, doorId, duration } });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // GET /devices/:id/users — List enrolled users on the device
  // ────────────────────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/devices/:id/users',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const device = await getDeviceOrFail(request.params.id, request.tenantId);
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      const users = await zktecoService.getUsers(device.ipAddress!, device.port ?? undefined);
      return reply.send({ success: true, data: users, count: users.length });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // POST /devices/:id/users — Add / enroll a user on the device
  // ────────────────────────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { id: string; name: string; privilege?: number; cardNumber?: string };
  }>(
    '/devices/:id/users',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const device = await getDeviceOrFail(request.params.id, request.tenantId);
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      const { id: userId, name, privilege, cardNumber } = request.body;
      if (!userId || !name) {
        return reply.code(400).send({ success: false, error: 'id and name are required' });
      }

      const ok = await zktecoService.addUser(
        device.ipAddress!,
        { id: userId, name, privilege: privilege ?? 0, cardNumber },
        device.port ?? undefined,
      );

      await request.audit('zkteco.user.enroll', 'devices', device.id, { userId, name });

      return reply.code(201).send({ success: true, data: { enrolled: ok, userId, name } });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // DELETE /devices/:id/users/:userId — Remove user from device
  // ────────────────────────────────────────────────────────────────────────────
  app.delete<{ Params: { id: string; userId: string } }>(
    '/devices/:id/users/:userId',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const device = await getDeviceOrFail(request.params.id, request.tenantId);
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      const ok = await zktecoService.deleteUser(
        device.ipAddress!,
        request.params.userId,
        device.port ?? undefined,
      );

      await request.audit('zkteco.user.delete', 'devices', device.id, { userId: request.params.userId });

      return reply.code(200).send({ success: true, data: { deleted: ok } });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // GET /devices/:id/logs — Retrieve attendance / access logs from device
  // ────────────────────────────────────────────────────────────────────────────
  app.get<{
    Params: { id: string };
    Querystring: { from?: string };
  }>(
    '/devices/:id/logs',
    { preHandler: [requireRole('auditor', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const device = await getDeviceOrFail(request.params.id, request.tenantId);
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      const from = request.query.from ? new Date(request.query.from) : undefined;
      if (from && isNaN(from.getTime())) {
        return reply.code(400).send({ success: false, error: 'Invalid from date' });
      }

      const logs = await zktecoService.getAttendanceLogs(
        device.ipAddress!,
        from,
        device.port ?? undefined,
      );

      return reply.send({ success: true, data: logs, count: logs.length });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // POST /devices/:id/sync — Sync device users/logs with platform database
  // ────────────────────────────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/devices/:id/sync',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const device = await getDeviceOrFail(request.params.id, request.tenantId);
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      const tenantId = request.tenantId;
      let usersSynced = 0;
      let logsSynced = 0;

      // ── Sync users ────────────────────────────────────────────────────────
      try {
        const deviceUsers = await zktecoService.getUsers(device.ipAddress!, device.port ?? undefined);

        for (const du of deviceUsers) {
          // Try to match by documentId (= device Pin) or by card number
          const conditions = [eq(accessPeople.tenantId, tenantId)];
          const matchConditions = du.cardNumber
            ? [
                and(...conditions, eq(accessPeople.documentId, du.id)),
                and(...conditions, eq(accessPeople.documentId, du.cardNumber)),
              ]
            : [and(...conditions, eq(accessPeople.documentId, du.id))];

          let matched = false;
          for (const cond of matchConditions) {
            const [existing] = await db
              .select({ id: accessPeople.id })
              .from(accessPeople)
              .where(cond!)
              .limit(1);
            if (existing) {
              matched = true;
              break;
            }
          }

          if (!matched) {
            await db.insert(accessPeople).values({
              tenantId,
              fullName: du.name || `ZKTeco User ${du.id}`,
              documentId: du.id,
              type: 'employee',
              status: du.enabled ? 'active' : 'inactive',
              notes: `Auto-synced from ZKTeco device ${device.name}. Card: ${du.cardNumber ?? 'N/A'}`,
            });
            usersSynced++;
          }
        }
      } catch (err) {
        app.log.error({ err, deviceId: device.id }, 'Failed to sync users from ZKTeco device');
      }

      // ── Sync access logs ──────────────────────────────────────────────────
      try {
        // Fetch logs since last sync (fallback: last 24 h)
        const lastSyncDate = device.lastSeen ?? new Date(Date.now() - 86_400_000);
        const logs = await zktecoService.getAttendanceLogs(
          device.ipAddress!,
          lastSyncDate,
          device.port ?? undefined,
        );

        for (const log of logs) {
          // Resolve person by device Pin (= documentId)
          const [person] = await db
            .select({ id: accessPeople.id, sectionId: accessPeople.sectionId })
            .from(accessPeople)
            .where(
              and(
                eq(accessPeople.tenantId, tenantId),
                eq(accessPeople.documentId, log.userId),
              ),
            )
            .limit(1);

          await db.insert(accessLogs).values({
            tenantId,
            sectionId: person?.sectionId ?? null,
            personId: person?.id ?? null,
            direction: log.status === 0 ? 'in' : 'out',
            method: log.verifyMethod,
            notes: `ZKTeco device: ${device.name}`,
            operatorId: null,
          });
          logsSynced++;
        }
      } catch (err) {
        app.log.error({ err, deviceId: device.id }, 'Failed to sync logs from ZKTeco device');
      }

      // Update last seen
      await db
        .update(devices)
        .set({ lastSeen: new Date(), status: 'online', updatedAt: new Date() })
        .where(eq(devices.id, device.id));

      await request.audit('zkteco.device.sync', 'devices', device.id, { usersSynced, logsSynced });

      return reply.send({
        success: true,
        data: { usersSynced, logsSynced, syncedAt: new Date().toISOString() },
      });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // POST /webhook/zkteco — Receive push events from ZKTeco devices (NO AUTH)
  // ────────────────────────────────────────────────────────────────────────────
  app.post(
    '/webhook/zkteco',
    { config: { rawBody: true } },
    async (request, reply) => {
      const event: ZKPushEvent | null = zktecoService.parsePushEvent(request.body);
      if (!event || !event.serialNumber) {
        app.log.warn({ body: request.body }, 'Received unparseable ZKTeco push event');
        return reply.code(400).send({ success: false, error: 'Invalid event payload' });
      }

      app.log.info(
        { serial: event.serialNumber, pin: event.pin, door: event.door },
        'ZKTeco push event received',
      );

      // Look up the paired device by serial number
      const [device] = await db
        .select()
        .from(devices)
        .where(
          and(
            eq(devices.serialNumber, event.serialNumber),
            eq(devices.brand, ZKTECO_BRAND),
          ),
        )
        .limit(1);

      if (!device) {
        app.log.warn({ serial: event.serialNumber }, 'Push event from unknown ZKTeco device');
        // Return 200 so device does not retry endlessly
        return reply.send({ success: false, error: 'Unknown device' });
      }

      // Update device heartbeat
      await db
        .update(devices)
        .set({ status: 'online', lastSeen: new Date(), updatedAt: new Date() })
        .where(eq(devices.id, device.id));

      // Match person by documentId (Pin) or card number
      let person: { id: string; sectionId: string | null } | undefined;

      if (event.pin) {
        const [byPin] = await db
          .select({ id: accessPeople.id, sectionId: accessPeople.sectionId })
          .from(accessPeople)
          .where(
            and(
              eq(accessPeople.tenantId, device.tenantId),
              eq(accessPeople.documentId, event.pin),
            ),
          )
          .limit(1);
        person = byPin;
      }

      if (!person && event.cardNumber) {
        const [byCard] = await db
          .select({ id: accessPeople.id, sectionId: accessPeople.sectionId })
          .from(accessPeople)
          .where(
            and(
              eq(accessPeople.tenantId, device.tenantId),
              eq(accessPeople.documentId, event.cardNumber),
            ),
          )
          .limit(1);
        person = byCard;
      }

      // Create access log entry
      const direction = event.inOutState === 0 ? 'in' : 'out';
      const method = verifyModeToMethod(event.verifyMode);

      const [logEntry] = await db
        .insert(accessLogs)
        .values({
          tenantId: device.tenantId,
          sectionId: person?.sectionId ?? null,
          personId: person?.id ?? null,
          direction,
          method,
          notes: `ZKTeco push | door=${event.door} | serial=${event.serialNumber}`,
          operatorId: null,
        })
        .returning();

      // ── Trigger automation rules (fire-and-forget) ────────────────────────
      triggerAutomations(app, device.tenantId, {
        eventType: 'access',
        direction,
        personId: person?.id,
        deviceId: device.id,
        door: event.door,
        method,
      });

      return reply.send({ success: true, data: { logId: logEntry.id } });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // GET /stats — Dashboard statistics for ZKTeco devices
  // ────────────────────────────────────────────────────────────────────────────
  app.get(
    '/stats',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;

      // Device counts
      const [deviceStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
          offline: sql<number>`count(*) filter (where ${devices.status} != 'online')::int`,
        })
        .from(devices)
        .where(
          and(
            eq(devices.tenantId, tenantId),
            eq(devices.brand, ZKTECO_BRAND),
          ),
        );

      // Events today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [eventStats] = await db
        .select({
          eventsToday: sql<number>`count(*)::int`,
        })
        .from(accessLogs)
        .where(
          and(
            eq(accessLogs.tenantId, tenantId),
            sql`${accessLogs.method} != 'manual'`,
            sql`${accessLogs.createdAt} >= ${todayStart.toISOString()}`,
          ),
        );

      // Enrolled people count
      const [peopleStats] = await db
        .select({
          enrolledUsers: sql<number>`count(*)::int`,
        })
        .from(accessPeople)
        .where(
          and(
            eq(accessPeople.tenantId, tenantId),
            eq(accessPeople.status, 'active'),
          ),
        );

      return reply.send({
        success: true,
        data: {
          devices: {
            total: deviceStats?.total ?? 0,
            online: deviceStats?.online ?? 0,
            offline: deviceStats?.offline ?? 0,
          },
          eventsToday: eventStats?.eventsToday ?? 0,
          enrolledUsers: peopleStats?.enrolledUsers ?? 0,
        },
      });
    },
  );

  // ── Internal helpers ──────────────────────────────────────────────────────

  async function getDeviceOrFail(id: string, tenantId: string) {
    const [device] = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.id, id),
          eq(devices.tenantId, tenantId),
          eq(devices.brand, ZKTECO_BRAND),
        ),
      )
      .limit(1);
    return device ?? null;
  }
}

// ── Automation trigger (fire-and-forget) ─────────────────────────────────────

function triggerAutomations(
  app: FastifyInstance,
  tenantId: string,
  eventData: Record<string, unknown>,
): void {
  // Import automation tables lazily to avoid circular deps
  import('../../db/schema/index.js')
    .then(async ({ automationRules }) => {
      if (!automationRules) return;
      const rules = await db
        .select()
        .from(automationRules)
        .where(
          and(
            eq(automationRules.tenantId, tenantId),
            eq(automationRules.isActive, true),
          ),
        );

      for (const rule of rules) {
        try {
          // The `trigger` jsonb stores { type: 'event'|'schedule'|..., config: {...} }
          const trigger = (rule.trigger ?? {}) as Record<string, unknown>;
          if (trigger.type !== 'event' && trigger.type !== 'access_event') continue;

          // The `conditions` jsonb is an array of { field, operator, value }
          const conditions = (Array.isArray(rule.conditions) ? rule.conditions : []) as Array<{
            field: string;
            operator: string;
            value: unknown;
          }>;

          const matches = conditions.every((cond) => {
            const actual = eventData[cond.field];
            switch (cond.operator) {
              case 'eq': return actual === cond.value;
              case 'neq': return actual !== cond.value;
              case 'in': return Array.isArray(cond.value) && cond.value.includes(actual);
              default: return actual === cond.value;
            }
          });
          if (!matches) continue;

          app.log.info({ ruleId: rule.id, eventData }, 'Automation rule triggered by ZKTeco event');
          // Future: execute the rule actions (webhook call, notification, relay, etc.)
        } catch (err) {
          app.log.error({ err, ruleId: rule.id }, 'Automation rule execution failed');
        }
      }
    })
    .catch((err) => {
      app.log.error({ err }, 'Failed to load automation rules for ZKTeco trigger');
    });
}
