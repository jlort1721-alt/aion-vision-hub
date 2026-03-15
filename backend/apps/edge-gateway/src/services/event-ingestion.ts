import type pino from 'pino';
import type { DeviceEventPayload, Unsubscribe } from '@aion/shared-contracts';
import { request } from 'undici';
import { config } from '../config/env.js';
import type { DeviceManager } from './device-manager.js';

export type EventCallback = (event: DeviceEventPayload) => void;

/**
 * Subscribes to device events and forwards them to the backend API.
 * Maintains subscription state per device and supports local callbacks.
 */
export class EventIngestionService {
  private subscriptions = new Map<string, Unsubscribe>();
  private callbacks = new Set<EventCallback>();
  private eventBuffer: DeviceEventPayload[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private logger: pino.Logger;
  private deviceManager: DeviceManager;

  constructor(deviceManager: DeviceManager, logger: pino.Logger) {
    this.deviceManager = deviceManager;
    this.logger = logger.child({ service: 'event-ingestion' });
  }

  start(): void {
    // Flush buffered events to backend every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
    this.logger.info('Event ingestion service started');
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Unsubscribe from all devices
    for (const [deviceId, unsub] of this.subscriptions) {
      unsub();
      this.logger.debug({ deviceId }, 'Unsubscribed from device events');
    }
    this.subscriptions.clear();
    this.flush().catch(() => {});
    this.logger.info('Event ingestion service stopped');
  }

  async subscribe(deviceId: string): Promise<void> {
    if (this.subscriptions.has(deviceId)) return;

    const adapter = this.deviceManager.getAdapter(deviceId);
    if (!adapter) {
      this.logger.warn({ deviceId }, 'Cannot subscribe: device not connected');
      return;
    }

    const unsub = await adapter.subscribe(deviceId, (event) => this.onEvent(event));
    this.subscriptions.set(deviceId, unsub);
    this.logger.info({ deviceId }, 'Subscribed to device events');
  }

  unsubscribe(deviceId: string): void {
    const unsub = this.subscriptions.get(deviceId);
    if (unsub) {
      unsub();
      this.subscriptions.delete(deviceId);
      this.logger.info({ deviceId }, 'Unsubscribed from device events');
    }
  }

  onCallback(callback: EventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  isSubscribed(deviceId: string): boolean {
    return this.subscriptions.has(deviceId);
  }

  private onEvent(event: DeviceEventPayload): void {
    this.eventBuffer.push(event);

    // Notify local callbacks (for WebSocket streaming)
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch (err) {
        this.logger.error({ err }, 'Event callback error');
      }
    }

    this.logger.debug({ deviceId: event.deviceId, type: event.eventType }, 'Event received');
  }

  private async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = this.eventBuffer.splice(0);
    try {
      await request(`${config.BACKEND_API_URL}/events/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.BACKEND_API_KEY ? { Authorization: `Bearer ${config.BACKEND_API_KEY}` } : {}),
        },
        body: JSON.stringify({ events }),
        headersTimeout: 10000,
      });
      this.logger.debug({ count: events.length }, 'Events flushed to backend');
    } catch (err) {
      // Put events back if flush fails
      this.eventBuffer.unshift(...events);
      this.logger.warn({ err, count: events.length }, 'Event flush failed, events re-queued');
    }
  }
}
