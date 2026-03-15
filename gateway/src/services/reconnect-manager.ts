import { logger } from '../utils/logger.js';
import { DeviceManager } from './device-manager.js';
import type { DeviceConnectionConfig } from '../adapters/types.js';

interface ReconnectEntry {
  config: DeviceConnectionConfig;
  attempts: number;
  lastAttempt: number;
  nextAttempt: number;
  status: 'pending' | 'reconnecting' | 'backoff' | 'abandoned';
}

interface ReconnectPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_POLICY: ReconnectPolicy = {
  maxAttempts: 10,
  baseDelayMs: 5000,
  maxDelayMs: 300000, // 5 minutes max
  backoffMultiplier: 2,
};

/**
 * ReconnectManager — handles automatic reconnection of failed devices.
 *
 * Uses exponential backoff with jitter to avoid thundering herd problems.
 * Tracks failed connections and automatically retries on a schedule.
 */
export class ReconnectManager {
  private entries = new Map<string, ReconnectEntry>();
  private policy: ReconnectPolicy;
  private deviceManager: DeviceManager;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(deviceManager: DeviceManager, policy?: Partial<ReconnectPolicy>) {
    this.deviceManager = deviceManager;
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  start(intervalMs = 10000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), intervalMs);
    logger.info('ReconnectManager started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('ReconnectManager stopped');
  }

  scheduleReconnect(deviceId: string, config: DeviceConnectionConfig): void {
    const existing = this.entries.get(deviceId);
    if (existing && existing.status === 'reconnecting') return;

    const attempts = existing ? existing.attempts : 0;
    const delay = this.calculateDelay(attempts);

    this.entries.set(deviceId, {
      config,
      attempts,
      lastAttempt: Date.now(),
      nextAttempt: Date.now() + delay,
      status: 'pending',
    });

    logger.info({ deviceId, nextAttemptIn: delay }, 'Scheduled reconnection');
  }

  cancelReconnect(deviceId: string): void {
    this.entries.delete(deviceId);
  }

  getStatus(): Array<{
    deviceId: string;
    attempts: number;
    nextAttemptIn: number;
    status: string;
  }> {
    const now = Date.now();
    return Array.from(this.entries.entries()).map(([id, entry]) => ({
      deviceId: id,
      attempts: entry.attempts,
      nextAttemptIn: Math.max(0, entry.nextAttempt - now),
      status: entry.status,
    }));
  }

  private async tick(): Promise<void> {
    const now = Date.now();

    for (const [deviceId, entry] of this.entries) {
      if (entry.status === 'reconnecting') continue;
      if (entry.status === 'abandoned') continue;
      if (now < entry.nextAttempt) continue;

      if (entry.attempts >= this.policy.maxAttempts) {
        entry.status = 'abandoned';
        logger.warn({ deviceId, attempts: entry.attempts }, 'Reconnection abandoned after max attempts');
        continue;
      }

      entry.status = 'reconnecting';
      entry.attempts++;
      entry.lastAttempt = now;

      try {
        logger.info({ deviceId, attempt: entry.attempts }, 'Attempting reconnection');
        const result = await this.deviceManager.connect(entry.config);

        if (result.success) {
          logger.info({ deviceId, attempts: entry.attempts }, 'Reconnection successful');
          this.entries.delete(deviceId);
        } else {
          const delay = this.calculateDelay(entry.attempts);
          entry.nextAttempt = Date.now() + delay;
          entry.status = 'backoff';
          logger.warn({ deviceId, nextRetryMs: delay }, 'Reconnection failed, backing off');
        }
      } catch (err) {
        const delay = this.calculateDelay(entry.attempts);
        entry.nextAttempt = Date.now() + delay;
        entry.status = 'backoff';
        logger.error({ deviceId, err }, 'Reconnection error');
      }
    }
  }

  private calculateDelay(attempts: number): number {
    const delay = Math.min(
      this.policy.baseDelayMs * Math.pow(this.policy.backoffMultiplier, attempts),
      this.policy.maxDelayMs,
    );
    // Add jitter (10-30% random variation)
    const jitter = delay * (0.1 + Math.random() * 0.2);
    return Math.floor(delay + jitter);
  }
}
