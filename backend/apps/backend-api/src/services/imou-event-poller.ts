/**
 * IMOU Cloud Event Poller
 *
 * Periodically polls IMOU/Dahua Cloud API for alarm events,
 * deduplicates via Redis, stores in the events table, and
 * publishes to the event bus for automation processing.
 */

import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import { eventBus } from './event-bus.js';
import { imouCloud } from './imou-cloud.js';
import crypto from 'crypto';

const logger = createLogger({ name: 'imou-event-poller' });

const POLL_INTERVAL_MS = parseInt(process.env.IMOU_POLL_INTERVAL_MS || '60000', 10);
const REDIS_DEDUP_PREFIX = 'imou:event:seen:';
const REDIS_DEDUP_TTL = 86400; // 24 hours — events older than this are considered "new" again
const IMOU_BASE = process.env.IMOU_BASE_URL || 'https://openapi-or.easy4ip.com';

interface ImouAlarmEvent {
  deviceId: string;
  channelId: string;
  msgType: string;
  time: number; // unix timestamp in seconds
  localDate?: string;
  data?: Record<string, unknown>;
}

interface ImouDeviceRecord {
  id: string;
  imou_device_id: string;
  site_id: string | null;
  tenant_id: string;
  name: string;
}

/**
 * Generate a deterministic dedup key for an IMOU event.
 */
function eventDeduplicationKey(deviceId: string, msgType: string, timestamp: number): string {
  return `${REDIS_DEDUP_PREFIX}${deviceId}:${msgType}:${timestamp}`;
}

/**
 * In-memory dedup set for when Redis is not available.
 */
const memoryDedup = new Set<string>();
const MEMORY_DEDUP_MAX = 10_000;

function memoryDedupCleanup(): void {
  if (memoryDedup.size > MEMORY_DEDUP_MAX) {
    // Clear oldest half — simple eviction since Set is insertion-ordered
    let i = 0;
    const halfSize = Math.floor(memoryDedup.size / 2);
    for (const key of memoryDedup) {
      if (i++ >= halfSize) break;
      memoryDedup.delete(key);
    }
  }
}

class ImouEventPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  /**
   * Start the polling loop.
   * @param intervalMs - polling interval in milliseconds (default from env or 60s)
   */
  start(intervalMs: number = POLL_INTERVAL_MS): void {
    if (this.intervalId) {
      logger.warn('IMOU event poller already running');
      return;
    }

    if (!imouCloud.isConfigured()) {
      logger.info('IMOU not configured (missing IMOU_APP_ID / IMOU_APP_SECRET) — event poller disabled');
      return;
    }

    logger.info({ interval: intervalMs }, 'IMOU event poller started');
    this.intervalId = setInterval(() => this.poll(), intervalMs);

    // Run first poll immediately
    this.poll();
  }

  /**
   * Stop the polling loop.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('IMOU event poller stopped');
  }

  /**
   * Execute one polling cycle. Fetches IMOU cameras from DB, queries each
   * for alarm events, deduplicates, stores, and publishes.
   */
  private async poll(): Promise<void> {
    if (this.running) {
      logger.debug('Poll cycle still running, skipping');
      return;
    }
    this.running = true;

    try {
      // Get IMOU cameras from DB (devices with connection_type = 'imou' or brand like 'dahua%'/'imou%')
      const devices = await db.execute(sql`
        SELECT id, imou_device_id, site_id, tenant_id, name
        FROM devices
        WHERE imou_device_id IS NOT NULL
          AND imou_device_id != ''
          AND status != 'disabled'
        ORDER BY name
      `) as unknown as ImouDeviceRecord[];

      if (!devices.length) {
        logger.debug('No IMOU devices found in DB');
        this.running = false;
        return;
      }

      logger.debug({ deviceCount: devices.length }, 'Polling IMOU events');

      let totalNew = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (const device of devices) {
        try {
          const newEvents = await this.pollDeviceEvents(device);
          totalNew += newEvents;
        } catch (err) {
          totalErrors++;
          logger.error(
            { err, deviceId: device.id, imouDeviceId: device.imou_device_id },
            'Error polling events for IMOU device',
          );
          // Continue to next device — one failure should not stop the loop
        }
      }

      if (totalNew > 0 || totalErrors > 0) {
        logger.info({ totalNew, totalSkipped, totalErrors, devices: devices.length }, 'IMOU poll cycle complete');
      }
    } catch (err) {
      logger.error({ err }, 'IMOU poll cycle failed');
    } finally {
      this.running = false;
    }
  }

  /**
   * Poll alarm events for a single IMOU device.
   * Returns count of new (non-duplicate) events stored.
   */
  private async pollDeviceEvents(device: ImouDeviceRecord): Promise<number> {
    const token = await imouCloud.getAccessToken();
    const nonce = crypto.randomBytes(16).toString('hex');
    const time = Math.floor(Date.now() / 1000).toString();
    const id = crypto.randomUUID();

    // Build IMOU API request — query alarms for the last poll interval
    const endTime = Math.floor(Date.now() / 1000);
    const beginTime = endTime - Math.ceil(POLL_INTERVAL_MS / 1000) - 10; // overlap 10s for safety

    const appId = process.env.IMOU_APP_ID || '';
    const appSecret = process.env.IMOU_APP_SECRET || '';
    const signStr = `time:${time},nonce:${nonce},appSecret:${appSecret}`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex');

    const resp = await fetch(`${IMOU_BASE}/openapi/getAlarmList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: { ver: '1.0', appId, sign, time, nonce, id, token },
        params: {
          deviceId: device.imou_device_id,
          channelId: '0',
          beginTime: beginTime.toString(),
          endTime: endTime.toString(),
          count: '50',
          msgType: '', // all types
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json() as Record<string, unknown>;
    const result = data.result as Record<string, unknown>;

    if (result?.code !== '0') {
      // Code 'TK1009' = no data, which is normal
      if (result?.code === 'TK1009' || result?.code === 'DV1034') return 0;
      logger.warn({ code: result?.code, msg: result?.msg, deviceId: device.imou_device_id }, 'IMOU alarm API non-zero code');
      return 0;
    }

    const alarms = ((result.data as Record<string, unknown>)?.alarms || []) as ImouAlarmEvent[];
    if (!alarms.length) return 0;

    let newCount = 0;

    for (const alarm of alarms) {
      const dedupKey = eventDeduplicationKey(alarm.deviceId, alarm.msgType, alarm.time);

      // Check dedup
      const isDuplicate = await this.isDuplicate(dedupKey);
      if (isDuplicate) continue;

      // Mark as seen
      await this.markSeen(dedupKey);

      // Store in events table
      const eventId = crypto.randomUUID();
      const timestamp = new Date(alarm.time * 1000).toISOString();

      try {
        await db.execute(sql`
          INSERT INTO events (id, tenant_id, type, source, severity, timestamp, site_id, device_id, data, created_at)
          VALUES (
            ${eventId},
            ${device.tenant_id},
            ${`imou.alarm.${alarm.msgType}`},
            ${'imou-cloud'},
            ${alarm.msgType === 'human' || alarm.msgType === 'crossLineDetection' ? 'warning' : 'info'},
            ${timestamp},
            ${device.site_id ?? null},
            ${device.id},
            ${JSON.stringify({ imouDeviceId: alarm.deviceId, channelId: alarm.channelId, msgType: alarm.msgType, ...(alarm.data || {}) })}::jsonb,
            NOW()
          )
          ON CONFLICT DO NOTHING
        `);
      } catch (err) {
        logger.error({ err, eventId }, 'Failed to persist IMOU event');
        continue;
      }

      // Publish to event bus for automation
      eventBus.publish({
        id: eventId,
        type: `imou.alarm.${alarm.msgType}`,
        source: 'imou-cloud',
        severity: alarm.msgType === 'human' || alarm.msgType === 'crossLineDetection' ? 'warning' : 'info',
        site_id: device.site_id ?? undefined,
        device_id: device.id,
        data: {
          imouDeviceId: alarm.deviceId,
          channelId: alarm.channelId,
          msgType: alarm.msgType,
          timestamp,
          deviceName: device.name,
        },
      }).catch((err) => {
        logger.error({ err, eventId }, 'Failed to publish IMOU event to bus');
      });

      newCount++;
    }

    if (newCount > 0) {
      logger.info({ deviceId: device.id, imouDeviceId: device.imou_device_id, newEvents: newCount }, 'IMOU events stored');
    }

    return newCount;
  }

  /**
   * Check if an event has already been processed (via Redis or in-memory).
   */
  private async isDuplicate(key: string): Promise<boolean> {
    if (redis) {
      try {
        const exists = await redis.exists(key);
        return exists === 1;
      } catch (err) {
        logger.warn({ err }, 'Redis dedup check failed, falling back to memory');
      }
    }
    return memoryDedup.has(key);
  }

  /**
   * Mark an event as seen (via Redis or in-memory).
   */
  private async markSeen(key: string): Promise<void> {
    if (redis) {
      try {
        await redis.setex(key, REDIS_DEDUP_TTL, '1');
        return;
      } catch (err) {
        logger.warn({ err }, 'Redis dedup set failed, falling back to memory');
      }
    }
    memoryDedupCleanup();
    memoryDedup.add(key);
  }
}

export const imouEventPoller = new ImouEventPoller();
