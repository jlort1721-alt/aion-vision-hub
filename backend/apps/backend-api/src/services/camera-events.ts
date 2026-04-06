import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { fetchWithTimeout } from '../lib/http-client.js';

const logger = createLogger({ name: 'camera-events' });

interface CameraEvent {
  type: string; // motion, intrusion, line_crossing, face_detected, plate_detected
  device_ip: string;
  channel: number;
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Camera Event Poller — checks for new events from cameras via go2rtc or RTSP snapshots.
 * This is a simplified version that checks camera status periodically.
 * Full event ingestion would use ISAPI alertStream (requires HTTP access to each DVR).
 */
export class CameraEventService {
  private intervalId: NodeJS.Timeout | null = null;
  private _lastEvents: CameraEvent[] = [];

  get lastEvents(): CameraEvent[] {
    return this._lastEvents;
  }

  start(intervalMs = 60000) {
    logger.info({ interval: intervalMs }, 'Camera event service started');
    this.intervalId = setInterval(() => this.checkCameraStatus(), intervalMs);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    logger.info('Camera event service stopped');
  }

  private async checkCameraStatus() {
    try {
      // Check go2rtc for camera status changes
      const resp = await fetchWithTimeout('http://localhost:1984/api/streams', { timeout: 5000 });
      const streams = await resp.json() as Record<string, Record<string, unknown>>;

      let onlineCount = 0;
      let offlineCount = 0;

      for (const [key, info] of Object.entries(streams)) {
        const hasProducers = Array.isArray(info.producers) && (info.producers as unknown[]).length > 0;

        if (hasProducers) onlineCount++;
        else offlineCount++;

        // Update device status in DB (device_slug matches the go2rtc stream key)
        await db.execute(sql`
          UPDATE devices SET status = ${hasProducers ? 'online' : 'offline'},
          last_seen = ${hasProducers ? sql`NOW()` : sql`last_seen`},
          updated_at = NOW() WHERE device_slug = ${key}
        `);
      }

      logger.info({ online: onlineCount, offline: offlineCount }, 'Camera status check');
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Camera status check failed');
    }
  }
}

export const cameraEvents = new CameraEventService();
