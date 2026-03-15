import { logger } from '../utils/logger.js';
import { DeviceManager } from './device-manager.js';
import { EventIngestionService } from './event-ingestion.js';
import type { DeviceEvent, IEventAdapter } from '../adapters/types.js';

/**
 * EventListenerService — manages per-device event subscriptions.
 *
 * Bridges adapter-level event listeners (Hikvision alertStream,
 * Dahua eventManager, ONVIF PullPoint) to the EventIngestionService
 * for normalization and database storage.
 *
 * Lifecycle:
 *   1. When a device connects, call attachDevice(deviceId, tenantId)
 *   2. Service checks if adapter supports IEventAdapter
 *   3. If yes, starts the event listener and routes events to ingestion
 *   4. On disconnect, call detachDevice(deviceId)
 */
export class EventListenerService {
  private deviceManager: DeviceManager;
  private eventIngestion: EventIngestionService;
  private activeListeners = new Map<string, { tenantId: string }>();

  constructor(deviceManager: DeviceManager, eventIngestion: EventIngestionService) {
    this.deviceManager = deviceManager;
    this.eventIngestion = eventIngestion;
  }

  attachDevice(deviceId: string, tenantId: string): void {
    if (this.activeListeners.has(deviceId)) {
      logger.debug({ deviceId }, 'Event listener already active');
      return;
    }

    const device = this.deviceManager.getDevice(deviceId);
    if (!device) {
      logger.warn({ deviceId }, 'Cannot attach event listener: device not found');
      return;
    }

    const adapter = device.adapter as Partial<IEventAdapter>;
    if (typeof adapter.startEventListener !== 'function') {
      logger.debug({ deviceId, brand: device.config.brand }, 'Adapter does not support IEventAdapter');
      return;
    }

    this.activeListeners.set(deviceId, { tenantId });

    adapter.startEventListener(deviceId, (event: DeviceEvent, sourceDeviceId: string) => {
      this.handleEvent(event, sourceDeviceId, tenantId, device.config.brand);
    });

    logger.info({ deviceId, brand: device.config.brand }, 'Event listener attached');
  }

  detachDevice(deviceId: string): void {
    if (!this.activeListeners.has(deviceId)) return;

    const device = this.deviceManager.getDevice(deviceId);
    const adapter = device?.adapter as Partial<IEventAdapter> | undefined;
    if (typeof adapter?.stopEventListener === 'function') {
      adapter.stopEventListener(deviceId);
    }

    this.activeListeners.delete(deviceId);
    logger.info({ deviceId }, 'Event listener detached');
  }

  detachAll(): void {
    for (const deviceId of this.activeListeners.keys()) {
      this.detachDevice(deviceId);
    }
  }

  getActiveListeners(): Array<{ deviceId: string; tenantId: string }> {
    return Array.from(this.activeListeners.entries()).map(([deviceId, meta]) => ({
      deviceId,
      tenantId: meta.tenantId,
    }));
  }

  private handleEvent(event: DeviceEvent, deviceId: string, tenantId: string, brand: string): void {
    logger.debug({ deviceId, eventType: event.eventType, brand }, 'Device event received');

    if (brand === 'hikvision') {
      this.eventIngestion.ingestHikvision(
        { eventType: event.eventType, channelID: event.channel, dateTime: event.timestamp, ...event.data },
        deviceId,
        tenantId,
      );
    } else if (brand === 'dahua') {
      this.eventIngestion.ingestDahua(
        { Code: event.eventType, index: event.channel - 1, action: event.data?.action as string },
        deviceId,
        tenantId,
      );
    } else {
      // Generic / ONVIF
      this.eventIngestion.ingestGeneric(
        {
          type: event.eventType,
          severity: 'info',
          source_device_id: deviceId,
          source_brand: brand,
          title: event.eventType.replace(/_/g, ' '),
          description: `ONVIF event: ${event.eventType} on channel ${event.channel}`,
          metadata: { channel: event.channel, ...event.data },
        },
        tenantId,
      );
    }
  }
}
