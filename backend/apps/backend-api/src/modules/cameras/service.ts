import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { createLogger } from '@aion/common-utils';
import { NotFoundError } from '@aion/shared-contracts';

const logger = createLogger({ name: 'camera-service' });

export interface CameraFilters {
  site_id?: string;
  brand?: string;
  status?: string;
}

export interface CreateCameraInput {
  name: string;
  channel_number?: number;
  stream_key?: string;
  device_id?: string;
  site_id?: string;
  brand?: string;
  is_lpr?: boolean;
  is_ptz?: boolean;
}

export interface UpdateCameraInput {
  name?: string;
  channel_number?: number;
  stream_key?: string;
  device_id?: string;
  site_id?: string;
  brand?: string;
  is_lpr?: boolean;
  is_ptz?: boolean;
  status?: string;
}

interface Go2RtcStream {
  producers?: Array<{ url?: string }>;
  consumers?: Array<{ url?: string }>;
}

interface Go2RtcStreamsResponse {
  [streamKey: string]: Go2RtcStream;
}

export class CameraService {
  /**
   * List all cameras for a tenant, with optional filters.
   */
  async list(tenantId: string, filters?: CameraFilters) {
    // Build dynamic query with raw SQL to handle optional filters
    let query = sql`SELECT * FROM cameras WHERE tenant_id = ${tenantId}`;

    if (filters?.site_id) {
      query = sql`SELECT * FROM cameras WHERE tenant_id = ${tenantId} AND site_id = ${filters.site_id}`;
      if (filters.brand) {
        query = sql`SELECT * FROM cameras WHERE tenant_id = ${tenantId} AND site_id = ${filters.site_id} AND brand = ${filters.brand}`;
        if (filters.status) {
          query = sql`SELECT * FROM cameras WHERE tenant_id = ${tenantId} AND site_id = ${filters.site_id} AND brand = ${filters.brand} AND status = ${filters.status}`;
        }
      } else if (filters.status) {
        query = sql`SELECT * FROM cameras WHERE tenant_id = ${tenantId} AND site_id = ${filters.site_id} AND status = ${filters.status}`;
      }
    } else if (filters?.brand) {
      query = sql`SELECT * FROM cameras WHERE tenant_id = ${tenantId} AND brand = ${filters.brand}`;
      if (filters.status) {
        query = sql`SELECT * FROM cameras WHERE tenant_id = ${tenantId} AND brand = ${filters.brand} AND status = ${filters.status}`;
      }
    } else if (filters?.status) {
      query = sql`SELECT * FROM cameras WHERE tenant_id = ${tenantId} AND status = ${filters.status}`;
    }

    // Append ordering
    const baseQuery = query;
    const finalQuery = sql`${baseQuery} ORDER BY name ASC`;

    const result = await db.execute(finalQuery);
    return result as unknown as Record<string, unknown>[];
  }

  /**
   * Get a single camera by ID, scoped to tenant.
   */
  async getById(id: string, tenantId: string) {
    const result = await db.execute(
      sql`SELECT * FROM cameras WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`,
    );
    const rows = result as unknown as Record<string, unknown>[];
    const camera = Array.isArray(rows) ? rows[0] : undefined;
    if (!camera) throw new NotFoundError('Camera', id);
    return camera;
  }

  /**
   * Get cameras grouped by site, including site name.
   */
  async getBySite(tenantId: string) {
    const result = await db.execute(sql`
      SELECT
        c.*,
        COALESCE(s.name, 'Unassigned') AS site_name
      FROM cameras c
      LEFT JOIN sites s ON s.id = c.site_id
      WHERE c.tenant_id = ${tenantId}
      ORDER BY site_name ASC, c.name ASC
    `);

    const rows = (result as unknown as Record<string, unknown>[]) as Array<Record<string, unknown>>;
    const grouped: Record<string, Array<Record<string, unknown>>> = {};

    for (const row of rows) {
      const siteName = String(row.site_name ?? 'Unassigned');
      if (!grouped[siteName]) grouped[siteName] = [];
      grouped[siteName].push(row);
    }

    return grouped;
  }

  /**
   * Create a new camera.
   */
  async create(data: CreateCameraInput, tenantId: string) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await db.execute(sql`
      INSERT INTO cameras (id, tenant_id, device_id, site_id, name, channel_number, stream_key, brand, is_lpr, is_ptz, status, created_at, updated_at)
      VALUES (
        ${id},
        ${tenantId},
        ${data.device_id ?? null},
        ${data.site_id ?? null},
        ${data.name},
        ${data.channel_number ?? null},
        ${data.stream_key ?? null},
        ${data.brand ?? null},
        ${data.is_lpr ?? false},
        ${data.is_ptz ?? false},
        'unknown',
        ${now},
        ${now}
      )
      RETURNING *
    `);

    const rows = result as unknown as Record<string, unknown>[];
    return Array.isArray(rows) ? rows[0] : rows;
  }

  /**
   * Update an existing camera.
   */
  async update(id: string, data: UpdateCameraInput, tenantId: string) {
    // We need to build the query with sql template tags for safety.
    // Since drizzle's sql tag doesn't support fully dynamic column sets easily,
    // we construct the update by reading the existing record and merging.
    const existing = await this.getById(id, tenantId); // throws NotFoundError if missing
    const record = existing as Record<string, unknown>;

    const merged = {
      name: data.name ?? record.name,
      channel_number: data.channel_number ?? record.channel_number,
      stream_key: data.stream_key ?? record.stream_key,
      device_id: data.device_id ?? record.device_id,
      site_id: data.site_id ?? record.site_id,
      brand: data.brand ?? record.brand,
      is_lpr: data.is_lpr !== undefined ? data.is_lpr : record.is_lpr,
      is_ptz: data.is_ptz !== undefined ? data.is_ptz : record.is_ptz,
      status: data.status ?? record.status,
    };
    const now = new Date().toISOString();

    const result = await db.execute(sql`
      UPDATE cameras
      SET
        name = ${merged.name},
        channel_number = ${merged.channel_number},
        stream_key = ${merged.stream_key},
        device_id = ${merged.device_id},
        site_id = ${merged.site_id},
        brand = ${merged.brand},
        is_lpr = ${merged.is_lpr},
        is_ptz = ${merged.is_ptz},
        status = ${merged.status},
        updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `);

    const rows = result as unknown as Record<string, unknown>[];
    const updated = Array.isArray(rows) ? rows[0] : undefined;
    if (!updated) throw new NotFoundError('Camera', id);
    return updated;
  }

  /**
   * Delete a camera by ID, scoped to tenant.
   */
  async delete(id: string, tenantId: string) {
    const result = await db.execute(sql`
      DELETE FROM cameras WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
    `);
    const rows = result as unknown as Record<string, unknown>[];
    const deleted = Array.isArray(rows) ? rows[0] : undefined;
    if (!deleted) throw new NotFoundError('Camera', id);
  }

  /**
   * Bulk create cameras for a tenant.
   */
  async bulkCreate(cameras: CreateCameraInput[], tenantId: string) {
    const created: unknown[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < cameras.length; i++) {
      try {
        const camera = await this.create(cameras[i], tenantId);
        created.push(camera);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ index: i, error: message });
      }
    }

    return { total: cameras.length, created: created.length, errors, cameras: created };
  }

  /**
   * Sync camera statuses by querying the go2rtc API.
   *
   * Fetches http://localhost:1984/api/streams, checks each camera's stream_key
   * against the response. If the stream has producers with length > 0, it's online.
   * Otherwise, offline. Updates the `status` and `last_seen` columns accordingly.
   */
  async syncStatus(tenantId: string) {
    // Fetch all cameras for this tenant
    const camerasResult = await db.execute(
      sql`SELECT id, stream_key, status FROM cameras WHERE tenant_id = ${tenantId}`,
    );
    const cameras = (camerasResult as unknown as Record<string, unknown>[]) as Array<Record<string, unknown>>;

    if (cameras.length === 0) {
      return { total: 0, online: 0, offline: 0, unchanged: 0 };
    }

    // Fetch go2rtc streams
    let go2rtcStreams: Go2RtcStreamsResponse = {};
    try {
      const response = await fetch('http://localhost:1984/api/streams', {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        go2rtcStreams = (await response.json()) as Go2RtcStreamsResponse;
      } else {
        logger.warn({ status: response.status }, 'go2rtc API returned non-OK status');
      }
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to fetch go2rtc streams API');
      // Return early with no changes if go2rtc is unreachable
      return { total: cameras.length, online: 0, offline: 0, unchanged: cameras.length, error: 'go2rtc unreachable' };
    }

    let online = 0;
    let offline = 0;
    let unchanged = 0;
    const now = new Date().toISOString();

    for (const camera of cameras) {
      const streamKey = camera.stream_key as string | null;
      if (!streamKey) {
        unchanged++;
        continue;
      }

      const streamData = go2rtcStreams[streamKey];
      const isOnline = streamData?.producers != null && streamData.producers.length > 0;
      const newStatus = isOnline ? 'online' : 'offline';
      const oldStatus = camera.status as string | null;

      if (newStatus === oldStatus) {
        unchanged++;
        continue;
      }

      if (isOnline) {
        await db.execute(sql`
          UPDATE cameras SET status = 'online', last_seen = ${now}, updated_at = ${now}
          WHERE id = ${camera.id}
        `);
        online++;
      } else {
        await db.execute(sql`
          UPDATE cameras SET status = 'offline', updated_at = ${now}
          WHERE id = ${camera.id}
        `);
        offline++;
      }
    }

    return { total: cameras.length, online, offline, unchanged };
  }
}

export const cameraService = new CameraService();
