/**
 * Clips Service
 *
 * Business logic for video clip management: list, get, export/request, and delete.
 */

import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const logger = createLogger({ name: 'clips-service' });

const CLIPS_DIR = process.env.CLIPS_UPLOAD_DIR || path.resolve('uploads/clips');
const GO2RTC_BASE = process.env.GO2RTC_URL || 'http://localhost:1984';

export interface ClipListFilters {
  page?: number;
  limit?: number;
  cameraId?: string;
}

export interface RequestClipInput {
  cameraId: string;
  startTime: string;
  endTime: string;
  quality: 'high' | 'medium' | 'low';
}

export interface ClipRecord {
  id: string;
  camera_id: string;
  filename: string;
  file_size: number;
  duration_sec: number;
  quality: string;
  start_time: string;
  end_time: string;
  created_by: string;
  created_at: string;
}

export interface ClipFileRecord {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
}

async function ensureClipsDir(): Promise<void> {
  await fs.mkdir(CLIPS_DIR, { recursive: true });
}

class ClipsService {
  /**
   * List clips for a tenant with pagination and optional camera filter.
   */
  async listClips(tenantId: string, filters: ClipListFilters = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;
    const cameraId = filters.cameraId;

    try {
      let rows: unknown[];
      let countResult: unknown[];

      if (cameraId) {
        rows = await db.execute(sql`
          SELECT id, camera_id, filename, file_size, duration_sec, quality, start_time, end_time, created_by, created_at
          FROM clips
          WHERE tenant_id = ${tenantId} AND camera_id = ${cameraId}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `) as unknown as unknown[];

        countResult = await db.execute(sql`
          SELECT count(*)::int AS total FROM clips
          WHERE tenant_id = ${tenantId} AND camera_id = ${cameraId}
        `) as unknown as unknown[];
      } else {
        rows = await db.execute(sql`
          SELECT id, camera_id, filename, file_size, duration_sec, quality, start_time, end_time, created_by, created_at
          FROM clips
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `) as unknown as unknown[];

        countResult = await db.execute(sql`
          SELECT count(*)::int AS total FROM clips
          WHERE tenant_id = ${tenantId}
        `) as unknown as unknown[];
      }

      const total = (countResult as Array<{ total: number }>)[0]?.total ?? 0;

      return {
        items: rows as ClipRecord[],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Clips query failed (table may not exist)');
      return {
        items: [] as ClipRecord[],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }
  }

  /**
   * Get a single clip's file metadata by ID, scoped to tenant.
   */
  async getClip(clipId: string, tenantId: string): Promise<ClipFileRecord | null> {
    const rows = await db.execute(sql`
      SELECT id, filename, file_path, file_size
      FROM clips
      WHERE id = ${clipId} AND tenant_id = ${tenantId}
      LIMIT 1
    `) as unknown as ClipFileRecord[];

    return rows.length ? rows[0] : null;
  }

  /**
   * Request (export) a new clip from a camera stream via go2rtc.
   *
   * Fetches an MP4 stream segment, writes it to disk, and stores
   * the metadata in the clips table.
   */
  async requestClip(
    tenantId: string,
    userId: string,
    input: RequestClipInput,
  ): Promise<{
    id: string;
    cameraId: string;
    cameraName: string;
    filename: string;
    fileSize: number;
    durationSec: number;
    quality: string;
    startTime: string;
    endTime: string;
  }> {
    await ensureClipsDir();

    // Look up camera
    const cameraRows = await db.execute(sql`
      SELECT id, name, device_slug, device_id
      FROM cameras
      WHERE id = ${input.cameraId} AND tenant_id = ${tenantId}
      LIMIT 1
    `) as unknown as Array<{ id: string; name: string; device_slug: string; device_id: string }>;

    if (!cameraRows.length) {
      throw new Error('CAMERA_NOT_FOUND');
    }

    const camera = cameraRows[0];
    const streamName = camera.device_slug || camera.id;

    // Calculate duration
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    const durationSec = Math.ceil((end.getTime() - start.getTime()) / 1000);

    if (durationSec <= 0 || durationSec > 3600) {
      throw new Error('INVALID_DURATION');
    }

    const clipId = crypto.randomUUID();
    const filename = `${clipId}.mp4`;
    const filePath = path.join(CLIPS_DIR, filename);

    // Fetch MP4 from go2rtc
    const streamUrl = `${GO2RTC_BASE}/api/stream.mp4?src=${encodeURIComponent(streamName)}&duration=${durationSec}`;
    logger.info({ streamUrl, clipId, durationSec }, 'Fetching clip from go2rtc');

    const resp = await fetch(streamUrl, {
      signal: AbortSignal.timeout(Math.max(durationSec * 1000 + 30000, 60000)),
    });

    if (!resp.ok) {
      logger.error({ status: resp.status, statusText: resp.statusText }, 'go2rtc stream.mp4 failed');
      throw new Error(`STREAM_ERROR: go2rtc returned ${resp.status}: ${resp.statusText}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      await fs.writeFile(filePath, buffer);
    } catch (err) {
      throw new Error(`EXPORT_FAILED: ${(err as Error).message}`);
    }

    logger.info({ clipId, size: buffer.length, durationSec }, 'Clip saved');

    await this.applyWatermark(filePath);

    // Store metadata in DB
    await db.execute(sql`
      INSERT INTO clips (id, tenant_id, camera_id, device_id, filename, file_path, file_size, duration_sec, quality, start_time, end_time, created_by, created_at)
      VALUES (
        ${clipId},
        ${tenantId},
        ${input.cameraId},
        ${camera.device_id},
        ${filename},
        ${filePath},
        ${buffer.length},
        ${durationSec},
        ${input.quality},
        ${input.startTime},
        ${input.endTime},
        ${userId},
        NOW()
      )
    `);

    return {
      id: clipId,
      cameraId: input.cameraId,
      cameraName: camera.name,
      filename,
      fileSize: buffer.length,
      durationSec,
      quality: input.quality,
      startTime: input.startTime,
      endTime: input.endTime,
    };
  }

  private async applyWatermark(inputPath: string): Promise<boolean> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      const outputPath = inputPath.replace(/\.mp4$/, '_wm.mp4');
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-vf', "drawtext=text='AION - %{localtime}':fontcolor=white@0.8:fontsize=16:x=10:y=10:shadowcolor=black@0.5:shadowx=1:shadowy=1",
        '-codec:a', 'copy',
        '-y', outputPath,
      ], { timeout: 60000 });
      const fsAsync = await import('fs/promises');
      await fsAsync.rename(outputPath, inputPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a clip by ID, scoped to tenant. Removes DB record and file from disk.
   */
  async deleteClip(clipId: string, tenantId: string): Promise<{ id: string; deleted: boolean }> {
    const rows = await db.execute(sql`
      DELETE FROM clips
      WHERE id = ${clipId} AND tenant_id = ${tenantId}
      RETURNING id, file_path
    `) as unknown as Array<{ id: string; file_path: string }>;

    if (!rows.length) {
      return { id: clipId, deleted: false };
    }

    const { file_path: filePath } = rows[0];
    await fs.unlink(filePath).catch((err) => {
      logger.warn({ err, filePath }, 'Failed to delete clip file from disk');
    });

    return { id: clipId, deleted: true };
  }

  /**
   * Read clip file from disk. Returns the buffer or null if missing.
   */
  async readClipFile(filePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }
}

export const clipsService = new ClipsService();
