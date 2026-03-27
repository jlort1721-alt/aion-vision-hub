import type pino from 'pino';
import type { DeviceEventPayload, Unsubscribe } from '@aion/shared-contracts';
import { request } from 'undici';
import { config } from '../config/env.js';
import type { DeviceManager, ManagedDevice } from './device-manager.js';
import { normalizeVendorEvent, buildEventTitle } from './event-normalizer.js';

export type EventCallback = (event: DeviceEventPayload) => void;

/** Shape of the normalized payload sent to the backend API batch endpoint. */
interface NormalizedEventPayload {
  deviceId: string;
  siteId?: string;
  type: string;
  severity: string;
  title: string;
  channel?: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

/**
 * Subscribes to device events and forwards them to the backend API.
 * Maintains subscription state per device and supports local callbacks.
 *
 * Events are normalized through the vendor-specific normalizer before
 * being buffered and flushed to the backend.
 */
export class EventIngestionService {
  private subscriptions = new Map<string, Unsubscribe>();
  private vendorPollers = new Map<string, Unsubscribe>();
  private callbacks = new Set<EventCallback>();
  private eventBuffer: NormalizedEventPayload[] = [];
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
    // Unsubscribe from all adapter-level subscriptions
    for (const [deviceId, unsub] of this.subscriptions) {
      unsub();
      this.logger.debug({ deviceId }, 'Unsubscribed from device events');
    }
    this.subscriptions.clear();

    // Stop all vendor-specific pollers
    for (const [deviceId, unsub] of this.vendorPollers) {
      unsub();
      this.logger.debug({ deviceId }, 'Stopped vendor event poller');
    }
    this.vendorPollers.clear();

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

    // Start vendor-specific event poller if applicable
    this.startVendorPoller(deviceId);
  }

  unsubscribe(deviceId: string): void {
    const unsub = this.subscriptions.get(deviceId);
    if (unsub) {
      unsub();
      this.subscriptions.delete(deviceId);
      this.logger.info({ deviceId }, 'Unsubscribed from device events');
    }

    // Stop vendor poller
    const pollerUnsub = this.vendorPollers.get(deviceId);
    if (pollerUnsub) {
      pollerUnsub();
      this.vendorPollers.delete(deviceId);
      this.logger.debug({ deviceId }, 'Stopped vendor event poller');
    }
  }

  onCallback(callback: EventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  isSubscribed(deviceId: string): boolean {
    return this.subscriptions.has(deviceId);
  }

  // ── Event Processing ────────────────────────────────────────

  private onEvent(event: DeviceEventPayload): void {
    // Resolve the device brand for normalization
    const device = this.deviceManager.getDevice(event.deviceId);
    const vendor = device?.brand ?? 'generic';

    // Normalize the event through the vendor-specific normalizer
    const normalized = normalizeVendorEvent(vendor, event as unknown as Record<string, unknown>, this.logger);
    const title = buildEventTitle(normalized);

    // Build the payload for the backend API
    const payload: NormalizedEventPayload = {
      deviceId: normalized.device_id,
      siteId: normalized.site_id ?? config.SITE_ID,
      type: normalized.type,
      severity: normalized.severity,
      title,
      channel: normalized.channel,
      timestamp: normalized.timestamp.toISOString(),
      metadata: {
        ...normalized.metadata,
        source: normalized.source,
      },
    };

    this.eventBuffer.push(payload);

    // Notify local callbacks (for WebSocket streaming) with original event shape
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch (err) {
        this.logger.error({ err }, 'Event callback error');
      }
    }

    this.logger.debug(
      { deviceId: event.deviceId, rawType: event.eventType, normalizedType: normalized.type, severity: normalized.severity },
      'Event received and normalized',
    );
  }

  // ── Vendor-Specific Event Polling ───────────────────────────

  /**
   * Start vendor-specific event polling for a device.
   *
   * - Hikvision: polls ISAPI /Event/notification/alertStream (long-polling HTTP)
   * - Dahua: polls CGI eventManager HTTP multipart event stream
   *
   * These pollers run in addition to the adapter subscription and handle
   * event types that the base adapter polling may not cover.
   */
  private startVendorPoller(deviceId: string): void {
    if (this.vendorPollers.has(deviceId)) return;

    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return;

    const brand = device.brand.toLowerCase();

    if (brand === 'hikvision' || brand === 'hik') {
      const unsub = this.startHikvisionPoller(deviceId, device);
      if (unsub) this.vendorPollers.set(deviceId, unsub);
    } else if (brand === 'dahua') {
      const unsub = this.startDahuaPoller(deviceId, device);
      if (unsub) this.vendorPollers.set(deviceId, unsub);
    }
  }

  /**
   * Hikvision ISAPI event polling.
   *
   * Opens a long-polling connection to /ISAPI/Event/notification/alertStream
   * which returns XML event notifications as a multipart HTTP stream.
   */
  private startHikvisionPoller(deviceId: string, device: ManagedDevice): Unsubscribe | null {
    const connConfig = device.config;
    if (!connConfig.ip || !connConfig.username) return null;

    let active = true;
    const pollInterval = 10_000; // 10s between poll attempts

    const poll = async () => {
      const baseUrl = `http://${connConfig.ip}:${connConfig.port || 80}`;
      const alertStreamUrl = `${baseUrl}/ISAPI/Event/notification/alertStream`;
      const authHeader = `Basic ${Buffer.from(`${connConfig.username}:${connConfig.password}`).toString('base64')}`;

      while (active) {
        try {
          const response = await request(alertStreamUrl, {
            method: 'GET',
            headers: {
              Authorization: authHeader,
              Accept: 'application/xml',
            },
            headersTimeout: 5000,
            bodyTimeout: pollInterval + 5000,
          });

          const body = await response.body.text();

          // Parse ISAPI alert XML events
          // Each event is wrapped in <EventNotificationAlert>...</EventNotificationAlert>
          const eventBlocks = body.match(/<EventNotificationAlert>[\s\S]*?<\/EventNotificationAlert>/g);
          if (eventBlocks) {
            for (const block of eventBlocks) {
              const eventType = this.extractXmlValue(block, 'eventType') ?? 'unknown';
              const channelId = this.extractXmlValue(block, 'channelID');
              const dateTime = this.extractXmlValue(block, 'dateTime');

              const rawEvent: DeviceEventPayload = {
                deviceId,
                eventType,
                severity: 'info',
                channel: channelId ? parseInt(channelId, 10) : undefined,
                timestamp: dateTime ? new Date(dateTime) : new Date(),
                metadata: { source: 'isapi_alert_stream', rawXml: block },
              };

              this.onEvent(rawEvent);
            }
          }
        } catch (err) {
          if (active) {
            this.logger.debug({ deviceId, err }, 'Hikvision alert stream poll cycle completed or errored');
          }
        }

        // Wait before next poll
        if (active) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
      }
    };

    poll().catch((err) => {
      this.logger.error({ deviceId, err }, 'Hikvision poller fatal error');
    });

    this.logger.info({ deviceId }, 'Hikvision ISAPI event poller started');
    return () => { active = false; };
  }

  /**
   * Dahua CGI event polling.
   *
   * Connects to /cgi-bin/eventManager.cgi?action=attach&codes=[All]
   * which returns multipart/x-mixed-replace event notifications.
   */
  private startDahuaPoller(deviceId: string, device: ManagedDevice): Unsubscribe | null {
    const connConfig = device.config;
    if (!connConfig.ip || !connConfig.username) return null;

    let active = true;
    const pollInterval = 10_000;

    const poll = async () => {
      const baseUrl = `http://${connConfig.ip}:${connConfig.port || 80}`;
      const eventUrl = `${baseUrl}/cgi-bin/eventManager.cgi?action=attach&codes=[All]`;
      const authHeader = `Basic ${Buffer.from(`${connConfig.username}:${connConfig.password}`).toString('base64')}`;

      while (active) {
        try {
          const response = await request(eventUrl, {
            method: 'GET',
            headers: {
              Authorization: authHeader,
            },
            headersTimeout: 5000,
            bodyTimeout: pollInterval + 5000,
          });

          const body = await response.body.text();

          // Dahua event stream uses key=value format separated by boundaries
          // Each event section contains Code, action, index fields
          const sections = body.split(/--myboundary/);
          for (const section of sections) {
            const codeMatch = section.match(/Code=(\w+)/);
            const actionMatch = section.match(/action=(\w+)/);
            const indexMatch = section.match(/index=(\d+)/);

            if (codeMatch && actionMatch) {
              const code = codeMatch[1];
              const action = actionMatch[1];

              // Only process "Start" events (not "Stop" or "Pulse")
              if (action !== 'Start' && action !== 'Pulse') continue;

              const rawEvent: DeviceEventPayload = {
                deviceId,
                eventType: code,
                severity: 'info',
                channel: indexMatch ? parseInt(indexMatch[1], 10) + 1 : undefined,
                timestamp: new Date(),
                metadata: { source: 'dahua_event_stream', action, rawSection: section.trim() },
              };

              this.onEvent(rawEvent);
            }
          }
        } catch (err) {
          if (active) {
            this.logger.debug({ deviceId, err }, 'Dahua event stream poll cycle completed or errored');
          }
        }

        if (active) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
      }
    };

    poll().catch((err) => {
      this.logger.error({ deviceId, err }, 'Dahua poller fatal error');
    });

    this.logger.info({ deviceId }, 'Dahua CGI event poller started');
    return () => { active = false; };
  }

  // ── Helpers ─────────────────────────────────────────────────

  /** Extract a value from an XML tag like <tagName>value</tagName>. */
  private extractXmlValue(xml: string, tagName: string): string | null {
    const match = xml.match(new RegExp(`<${tagName}>([^<]*)</${tagName}>`));
    return match ? match[1] : null;
  }

  // ── Flush to Backend API ────────────────────────────────────

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
      this.logger.debug({ count: events.length }, 'Normalized events flushed to backend');
    } catch (err) {
      // Put events back if flush fails
      this.eventBuffer.unshift(...events);
      this.logger.warn({ err, count: events.length }, 'Event flush failed, events re-queued');
    }
  }
}
