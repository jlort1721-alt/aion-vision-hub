import type pino from 'pino';
import type { DeviceHealthReport } from '@aion/shared-contracts';
import { withRetry } from '@aion/common-utils';
import { config } from '../config/env.js';
import type { DeviceManager } from './device-manager.js';
import type { StreamManager } from './stream-manager.js';

export interface DeviceHealthStatus {
  deviceId: string;
  health: DeviceHealthReport;
  consecutiveFailures: number;
  lastSuccess?: Date;
}

/**
 * Periodic health monitor for connected devices.
 * Automatically triggers reconnection on persistent failures.
 */
export class HealthMonitor {
  private healthMap = new Map<string, DeviceHealthStatus>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private logger: pino.Logger;
  private deviceManager: DeviceManager;
  private streamManager: StreamManager;

  constructor(deviceManager: DeviceManager, streamManager: StreamManager, logger: pino.Logger) {
    this.deviceManager = deviceManager;
    this.streamManager = streamManager;
    this.logger = logger.child({ service: 'health-monitor' });
  }

  start(): void {
    this.interval = setInterval(() => this.checkAll(), config.DEVICE_PING_INTERVAL_MS);
    this.logger.info({ intervalMs: config.DEVICE_PING_INTERVAL_MS }, 'Health monitor started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.info('Health monitor stopped');
  }

  async checkDevice(deviceId: string): Promise<DeviceHealthReport> {
    const adapter = this.deviceManager.getAdapter(deviceId);
    if (!adapter) {
      return { online: false, latencyMs: -1, errors: ['Not connected'], lastChecked: new Date() };
    }

    const health = await adapter.getHealth(deviceId);
    const status = this.healthMap.get(deviceId) ?? {
      deviceId,
      health,
      consecutiveFailures: 0,
    };

    if (health.online) {
      status.consecutiveFailures = 0;
      status.lastSuccess = new Date();
      this.streamManager.transitionState(deviceId, 'live', 'Health check passed');
    } else {
      status.consecutiveFailures++;
      this.logger.warn({
        deviceId,
        failures: status.consecutiveFailures,
        errors: health.errors,
      }, 'Device health check failed');

      if (status.consecutiveFailures >= 3) {
        this.streamManager.transitionState(deviceId, 'degraded', 'Multiple health check failures');
      }

      if (status.consecutiveFailures >= config.DEVICE_RECONNECT_MAX_ATTEMPTS) {
        this.attemptReconnect(deviceId).catch((err) => {
          this.logger.error({ deviceId, err }, 'Reconnection failed');
        });
      }
    }

    status.health = health;
    this.healthMap.set(deviceId, status);
    return health;
  }

  getHealth(deviceId: string): DeviceHealthStatus | undefined {
    return this.healthMap.get(deviceId);
  }

  getAllHealth(): DeviceHealthStatus[] {
    return Array.from(this.healthMap.values());
  }

  private async checkAll(): Promise<void> {
    const devices = this.deviceManager.listDevices();
    const checks = devices.map((d) => this.checkDevice(d.deviceId).catch(() => {}));
    await Promise.allSettled(checks);
  }

  private async attemptReconnect(deviceId: string): Promise<void> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return;

    this.streamManager.transitionState(deviceId, 'reconnecting', 'Auto-reconnect triggered');
    this.logger.info({ deviceId }, 'Attempting auto-reconnect');

    try {
      await withRetry(
        async () => {
          await this.deviceManager.disconnect(deviceId);
          const result = await this.deviceManager.connect(device.config);
          if (!result.success) throw new Error(result.message);
        },
        {
          maxAttempts: 3,
          baseDelayMs: config.DEVICE_RECONNECT_BASE_DELAY_MS,
          maxDelayMs: 30000,
          backoffFactor: 2,
          jitter: true,
        },
        this.logger,
      );

      this.logger.info({ deviceId }, 'Device reconnected successfully');
      const status = this.healthMap.get(deviceId);
      if (status) status.consecutiveFailures = 0;
    } catch (err) {
      this.logger.error({ deviceId, err }, 'Auto-reconnect exhausted');
      this.streamManager.transitionState(deviceId, 'failed', 'Reconnect exhausted');
    }
  }
}
