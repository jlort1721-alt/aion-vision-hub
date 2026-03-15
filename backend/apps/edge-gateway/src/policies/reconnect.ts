import type pino from 'pino';
import { config } from '../config/env.js';

export interface ReconnectState {
  deviceId: string;
  attempts: number;
  lastAttempt?: Date;
  nextAttemptAt?: Date;
  status: 'idle' | 'waiting' | 'reconnecting' | 'exhausted';
}

/**
 * Reconnection policy with exponential backoff and jitter.
 * Tracks per-device reconnection state.
 */
export class ReconnectPolicy {
  private states = new Map<string, ReconnectState>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ service: 'reconnect-policy' });
  }

  shouldReconnect(deviceId: string): boolean {
    const state = this.states.get(deviceId);
    if (!state) return true;
    return state.attempts < config.DEVICE_RECONNECT_MAX_ATTEMPTS;
  }

  scheduleReconnect(deviceId: string, reconnectFn: () => Promise<void>): void {
    let state = this.states.get(deviceId);
    if (!state) {
      state = { deviceId, attempts: 0, status: 'idle' };
      this.states.set(deviceId, state);
    }

    if (state.attempts >= config.DEVICE_RECONNECT_MAX_ATTEMPTS) {
      state.status = 'exhausted';
      this.logger.warn({ deviceId, attempts: state.attempts }, 'Reconnect attempts exhausted');
      return;
    }

    state.attempts++;
    const delay = this.calculateDelay(state.attempts);
    state.status = 'waiting';
    state.lastAttempt = new Date();
    state.nextAttemptAt = new Date(Date.now() + delay);

    this.logger.info({ deviceId, attempt: state.attempts, delayMs: delay }, 'Scheduling reconnect');

    // Clear any existing timer
    const existingTimer = this.timers.get(deviceId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      state!.status = 'reconnecting';
      try {
        await reconnectFn();
        this.reset(deviceId);
        this.logger.info({ deviceId }, 'Reconnect successful');
      } catch (err) {
        this.logger.error({ deviceId, err }, 'Reconnect attempt failed');
        this.scheduleReconnect(deviceId, reconnectFn);
      }
    }, delay);

    this.timers.set(deviceId, timer);
  }

  reset(deviceId: string): void {
    const timer = this.timers.get(deviceId);
    if (timer) clearTimeout(timer);
    this.timers.delete(deviceId);
    this.states.delete(deviceId);
  }

  getState(deviceId: string): ReconnectState | undefined {
    return this.states.get(deviceId);
  }

  stopAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.states.clear();
  }

  private calculateDelay(attempt: number): number {
    const base = config.DEVICE_RECONNECT_BASE_DELAY_MS;
    const exponential = base * Math.pow(2, attempt - 1);
    const capped = Math.min(exponential, 60000);
    // Add jitter: random 0-30% of delay
    const jitter = Math.floor(Math.random() * capped * 0.3);
    return capped + jitter;
  }
}
