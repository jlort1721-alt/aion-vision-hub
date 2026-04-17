import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { createHash } from "node:crypto";

export interface AccessDoor {
  id: string;
  siteId: string | null;
  siteName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  deviceIp: string | null;
  devicePort: number | null;
  hasIntercom: boolean;
  hasIvms: boolean;
  hasHikconnect: boolean;
  notes: string | null;
  lastEventAt: string | null;
}

export interface DoorOpenResult {
  ok: boolean;
  doorId: string;
  commandId: string;
  mode: "isapi" | "queued" | "stub";
  message: string;
}

export interface DoorEvent {
  id: string;
  doorId: string;
  eventType: string;
  occurredAt: string;
  personId: string | null;
  metadata: unknown;
}

export const accessDoorsService = {
  async listDoors(_tenantId: string, siteId?: string): Promise<AccessDoor[]> {
    const rows = await db.execute(sql`
      SELECT
        ad.id,
        ad.site_id       AS "siteId",
        s.name           AS "siteName",
        d.id             AS "deviceId",
        d.name           AS "deviceName",
        d.ip_address     AS "deviceIp",
        d.port           AS "devicePort",
        ad.has_intercom  AS "hasIntercom",
        ad.has_ivms      AS "hasIvms",
        ad.has_hikconnect AS "hasHikconnect",
        ad.notes,
        (SELECT MAX(occurred_at) FROM access_logs al WHERE al.door_id = ad.id) AS "lastEventAt"
      FROM access_doors ad
      LEFT JOIN sites s ON s.id = ad.site_id
      LEFT JOIN devices d ON d.site_id = ad.site_id
        AND d.type = 'access_control'
        AND d.deleted_at IS NULL
      WHERE ${siteId ? sql`ad.site_id = ${siteId}` : sql`1=1`}
      ORDER BY s.name NULLS LAST, ad.id
    `);
    return rows as unknown as AccessDoor[];
  },

  async getDoorById(
    doorId: string,
    _tenantId: string,
  ): Promise<AccessDoor | null> {
    const rows = await db.execute(sql`
      SELECT
        ad.id,
        ad.site_id       AS "siteId",
        s.name           AS "siteName",
        d.id             AS "deviceId",
        d.name           AS "deviceName",
        d.ip_address     AS "deviceIp",
        d.port           AS "devicePort",
        ad.has_intercom  AS "hasIntercom",
        ad.has_ivms      AS "hasIvms",
        ad.has_hikconnect AS "hasHikconnect",
        ad.notes,
        NULL::timestamptz AS "lastEventAt"
      FROM access_doors ad
      LEFT JOIN sites s ON s.id = ad.site_id
      LEFT JOIN devices d ON d.site_id = ad.site_id
        AND d.type = 'access_control'
        AND d.deleted_at IS NULL
      WHERE ad.id = ${doorId}
      LIMIT 1
    `);
    const row = (rows as unknown as AccessDoor[])[0];
    return row ?? null;
  },

  async openDoor(
    doorId: string,
    tenantId: string,
    operatorId: string,
    reason: string,
    durationSeconds: number,
  ): Promise<DoorOpenResult> {
    const door = await this.getDoorById(doorId, tenantId);
    if (!door) {
      throw new Error(`Door ${doorId} not found`);
    }

    const commandId = createHash("sha256")
      .update(`${doorId}:${operatorId}:${Date.now()}`)
      .digest("hex")
      .slice(0, 16);

    // Emit command event to the canonical bus. A worker (access-orchestrator)
    // consumes `aion/commands/door/open` and executes the ISAPI call against
    // the real Hikvision AccessControl endpoint.
    await db.execute(sql`
      INSERT INTO access_door_events (
        id, tenant_id, door_id, event_type, operator_id, metadata, occurred_at, created_at
      ) VALUES (
        gen_random_uuid(),
        ${tenantId},
        ${doorId},
        'remote_open_requested',
        ${operatorId}::uuid,
        ${JSON.stringify({
          command_id: commandId,
          reason,
          duration_seconds: durationSeconds,
          device_ip: door.deviceIp,
          device_port: door.devicePort,
        })}::jsonb,
        NOW(),
        NOW()
      )
    `);

    // If device info is absent, we only log the request ("stub" mode).
    if (!door.deviceIp || !door.devicePort) {
      return {
        ok: true,
        doorId,
        commandId,
        mode: "stub",
        message: "Request logged; no device bound for physical execution",
      };
    }

    return {
      ok: true,
      doorId,
      commandId,
      mode: "queued",
      message: `Command queued for access-orchestrator worker (device ${door.deviceIp}:${door.devicePort})`,
    };
  },

  async getHistory(
    doorId: string,
    tenantId: string,
    limit: number,
    from?: string,
    to?: string,
  ): Promise<DoorEvent[]> {
    const fromClause = from
      ? sql`AND occurred_at >= ${from}::timestamptz`
      : sql``;
    const toClause = to ? sql`AND occurred_at <= ${to}::timestamptz` : sql``;

    const rows = await db.execute(sql`
      SELECT
        id,
        door_id    AS "doorId",
        event_type AS "eventType",
        occurred_at AS "occurredAt",
        person_id  AS "personId",
        metadata
      FROM access_door_events
      WHERE door_id = ${doorId}
        AND tenant_id = ${tenantId}
        ${fromClause}
        ${toClause}
      ORDER BY occurred_at DESC
      LIMIT ${limit}
    `);
    return rows as unknown as DoorEvent[];
  },
};
