import * as net from 'net';
import { eq, and, isNotNull } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';
import type { Database } from '../db/client.js';
import { sites, devices } from '../db/schema/index.js';
import { dispatchDeviceStateChange } from './notification-dispatcher.js';

const logger = createLogger({ name: 'health-check-worker' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  deviceId: string;
  reachable: boolean;
  latencyMs: number | null;
  checkedAt: Date;
}

// ---------------------------------------------------------------------------
// Results cache — latest check result per device ID
// ---------------------------------------------------------------------------

export const healthCheckCache = new Map<string, HealthCheckResult>();

// ---------------------------------------------------------------------------
// Non-checkable device types (network infra / cloud accounts / domotics)
// ---------------------------------------------------------------------------

const SKIP_TYPES = new Set([
  'network_wan',
  'network_lan',
  'cloud_account_ewelink',
  'cloud_account_hik',
  'domotic',
]);

// ---------------------------------------------------------------------------
// TCP ping helper
// ---------------------------------------------------------------------------

function tcpPing(
  host: string,
  port: number,
  timeoutMs = 5000,
): Promise<{ reachable: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ reachable: true, latencyMs });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: null });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: null });
    });

    socket.connect(port, host);
  });
}

// ---------------------------------------------------------------------------
// Single tick — run one full health-check sweep
// ---------------------------------------------------------------------------

async function runHealthCheck(db: Database): Promise<void> {
  const checkedAt = new Date();

  // 1. Query all sites that have a WAN IP set
  const siteRows = await db
    .select({ id: sites.id, name: sites.name, wanIp: sites.wanIp })
    .from(sites)
    .where(isNotNull(sites.wanIp));

  let totalDevices = 0;
  let onlineCount = 0;
  let offlineCount = 0;

  for (const site of siteRows) {
    if (!site.wanIp) continue; // TS narrowing

    // 2. Query devices for this site that have a port set
    const deviceRows = await db
      .select({
        id: devices.id,
        name: devices.name,
        port: devices.port,
        type: devices.type,
        status: devices.status,
        tenantId: devices.tenantId,
      })
      .from(devices)
      .where(
        and(eq(devices.siteId, site.id), isNotNull(devices.port)),
      );

    // Filter out non-checkable types
    const checkable = deviceRows.filter((d) => !SKIP_TYPES.has(d.type));

    // 3. Check each device individually, catching errors per-device
    for (const device of checkable) {
      totalDevices++;

      try {
        const ping = await tcpPing(site.wanIp, device.port!);
        const reachable = ping.reachable;

        // Build and cache result
        const result: HealthCheckResult = {
          deviceId: device.id,
          reachable,
          latencyMs: ping.latencyMs,
          checkedAt,
        };
        healthCheckCache.set(device.id, result);

        // Determine new status
        const newStatus = reachable ? 'online' : 'offline';

        if (reachable) {
          onlineCount++;
        } else {
          offlineCount++;
        }

        // 4. Detect state changes and update DB
        const previousStatus = device.status;
        if (previousStatus !== newStatus) {
          logger.info({ deviceName: device.name, deviceId: device.id, previousStatus, newStatus, address: `${site.wanIp}:${device.port}` }, 'Device status changed');

          const updateData: Record<string, unknown> = {
            status: newStatus,
            updatedAt: new Date(),
          };

          // Touch lastSeen when device comes online
          if (reachable) {
            updateData.lastSeen = new Date();
          }

          await db
            .update(devices)
            .set(updateData)
            .where(
              and(eq(devices.id, device.id), eq(devices.tenantId, device.tenantId)),
            );

          // Dispatch notification for the state change
          try {
            await dispatchDeviceStateChange(db, {
              deviceId: device.id,
              deviceName: device.name,
              siteName: site.name,
              siteId: site.id,
              tenantId: device.tenantId,
              previousStatus,
              newStatus,
              wanIp: site.wanIp,
              port: device.port!,
            });
          } catch (dispatchErr) {
            logger.error({ err: dispatchErr, deviceName: device.name }, 'Notification dispatch failed');
          }
        } else if (reachable) {
          // Still online — just update lastSeen
          await db
            .update(devices)
            .set({ lastSeen: new Date(), updatedAt: new Date() })
            .where(
              and(eq(devices.id, device.id), eq(devices.tenantId, device.tenantId)),
            );
        }
      } catch (err) {
        // One failing device must not stop the whole sweep
        logger.error({ err, deviceName: device.name, deviceId: device.id }, 'Error checking device');
        offlineCount++;
      }
    }
  }

  // 5. Summary log
  logger.info({ sites: siteRows.length, totalDevices, onlineCount, offlineCount }, 'Health check complete');
}

// ---------------------------------------------------------------------------
// Public API — start / stop the periodic worker
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 300_000; // 5 minutes

let timerHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic health-check worker.
 *
 * @param db       Drizzle database instance
 * @param interval Tick interval in milliseconds (default: 5 min)
 * @returns A cleanup function that stops the worker
 */
export function startHealthCheckWorker(
  db: Database,
  interval: number = DEFAULT_INTERVAL_MS,
): () => void {
  // Prevent double-start
  if (timerHandle) {
    logger.warn('Worker already running — skipping duplicate start');
    return () => stopHealthCheckWorker();
  }

  logger.info({ intervalSec: interval / 1000 }, 'Starting health-check worker');

  // Run immediately on start, then on interval
  runHealthCheck(db).catch((err) => {
    logger.error({ err }, 'Initial run failed');
  });

  timerHandle = setInterval(() => {
    runHealthCheck(db).catch((err) => {
      logger.error({ err }, 'Tick failed');
    });
  }, interval);

  return () => stopHealthCheckWorker();
}

/**
 * Stop the health-check worker if running.
 */
export function stopHealthCheckWorker(): void {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
    logger.info('Worker stopped');
  }
}
