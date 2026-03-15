import type pino from 'pino';
import type { DiscoveredDevice } from '@aion/shared-contracts';
import type { DeviceManager } from './device-manager.js';

export interface DiscoveryResult {
  devices: DiscoveredDevice[];
  scannedAt: Date;
  durationMs: number;
  networkRange: string;
}

/**
 * Multi-protocol device discovery service.
 * Runs brand-specific discovery (SADP, DH-Discovery) and
 * generic ONVIF WS-Discovery in parallel.
 */
export class DiscoveryService {
  private lastResult: DiscoveryResult | null = null;
  private isScanning = false;
  private logger: pino.Logger;
  private deviceManager: DeviceManager;

  constructor(deviceManager: DeviceManager, logger: pino.Logger) {
    this.deviceManager = deviceManager;
    this.logger = logger.child({ service: 'discovery' });
  }

  async scan(networkRange: string, timeout = 10000, brands?: string[]): Promise<DiscoveryResult> {
    if (this.isScanning) {
      this.logger.warn('Discovery scan already in progress');
      return this.lastResult ?? { devices: [], scannedAt: new Date(), durationMs: 0, networkRange };
    }

    this.isScanning = true;
    const start = Date.now();

    try {
      const factory = this.deviceManager.getFactory();
      const allDevices: DiscoveredDevice[] = [];

      // Run discovery across all adapter brands in parallel
      const brandsToScan = brands ?? ['hikvision', 'dahua', 'onvif'];
      const discoveries = brandsToScan.map(async (brand) => {
        try {
          const adapter = factory.get(brand);
          const devices = await adapter.discover(networkRange, timeout);
          return devices;
        } catch (err) {
          this.logger.error({ brand, err }, 'Discovery failed for brand');
          return [];
        }
      });

      const results = await Promise.allSettled(discoveries);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allDevices.push(...result.value);
        }
      }

      // Deduplicate by IP:port
      const seen = new Set<string>();
      const deduped = allDevices.filter((d) => {
        const key = `${d.ip}:${d.port}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      this.lastResult = {
        devices: deduped,
        scannedAt: new Date(),
        durationMs: Date.now() - start,
        networkRange,
      };

      this.logger.info({
        found: deduped.length,
        durationMs: this.lastResult.durationMs,
        networkRange,
      }, 'Discovery scan complete');

      return this.lastResult;
    } finally {
      this.isScanning = false;
    }
  }

  async identify(ip: string, port: number): Promise<DiscoveredDevice | null> {
    const factory = this.deviceManager.getFactory();

    // Try each adapter until one identifies the device
    for (const brand of ['hikvision', 'dahua', 'onvif']) {
      try {
        const adapter = factory.get(brand);
        const identity = await adapter.identify(ip, port);
        if (identity) {
          return {
            ip,
            port,
            brand: identity.brand,
            model: identity.model,
            serial: identity.serial,
            protocols: adapter.supportedProtocols,
          };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  getLastResult(): DiscoveryResult | null {
    return this.lastResult;
  }

  isRunning(): boolean {
    return this.isScanning;
  }
}
