import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { HikvisionAdapter } from '../adapters/hikvision/adapter.js';
import { DahuaAdapter } from '../adapters/dahua/adapter.js';
import { OnvifAdapter } from '../adapters/onvif/adapter.js';
import type { DiscoveredDevice, DeviceIdentity } from '../adapters/types.js';

/**
 * DiscoveryService — multi-protocol device discovery.
 *
 * Runs ONVIF WS-Discovery (primary), plus Hikvision SADP and Dahua DHDiscover
 * (both stubbed) in parallel to find all devices on the local network.
 *
 * After discovery, brand identification is attempted sequentially:
 *   1. Hikvision ISAPI probe (GET /ISAPI/System/deviceInfo)
 *   2. Dahua CGI probe (GET /cgi-bin/magicBox.cgi?action=getSystemInfo)
 *   3. ONVIF fallback (connect and read deviceInformation)
 *
 * Deduplication: devices are keyed by ip:port. The first protocol to find
 * a device wins; subsequent protocols that find the same ip:port enrich
 * the existing entry with additional protocol support.
 */
export class DiscoveryService {
  private hikvision = new HikvisionAdapter();
  private dahua = new DahuaAdapter();
  private onvif = new OnvifAdapter();

  async discoverAll(
    networkRange?: string,
    timeout?: number,
  ): Promise<DiscoveredDevice[]> {
    const range = networkRange || config.DISCOVERY_NETWORK_RANGE;
    const timeoutMs = timeout || config.DISCOVERY_TIMEOUT_MS;

    logger.info({ networkRange: range, timeoutMs }, 'Starting multi-protocol discovery');

    const results = await Promise.allSettled([
      this.onvif.discover(range, timeoutMs),
      this.hikvision.discover(range, timeoutMs),
      this.dahua.discover(range, timeoutMs),
    ]);

    const devices: DiscoveredDevice[] = [];
    const seen = new Map<string, DiscoveredDevice>();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const device of result.value) {
          const key = `${device.ip}:${device.port}`;
          const existing = seen.get(key);
          if (existing) {
            // Merge protocols
            for (const proto of device.protocols) {
              if (!existing.protocols.includes(proto)) {
                existing.protocols.push(proto);
              }
            }
            // Prefer more specific brand
            if (existing.brand === 'onvif' && device.brand !== 'onvif') {
              existing.brand = device.brand;
              existing.model = device.model;
            }
          } else {
            seen.set(key, { ...device });
            devices.push(seen.get(key)!);
          }
        }
      } else {
        logger.warn({ reason: result.reason }, 'Discovery protocol failed');
      }
    }

    logger.info({ count: devices.length }, 'Discovery complete');
    return devices;
  }

  /**
   * Identify a specific device by IP.
   *
   * Tries brand-specific probes first (faster, more info), then ONVIF fallback.
   * Each probe uses a short timeout (3s) to avoid blocking.
   */
  async identifyDevice(
    ip: string,
    port: number,
  ): Promise<DeviceIdentity | null> {
    // Try Hikvision ISAPI first (most common in LATAM market)
    try {
      const identity = await this.hikvision.identify(ip, port);
      if (identity) {
        logger.info({ ip, port, brand: identity.brand, model: identity.model }, 'Device identified');
        return identity;
      }
    } catch {
      // Not Hikvision
    }

    // Try Dahua CGI
    try {
      const identity = await this.dahua.identify(ip, port);
      if (identity) {
        logger.info({ ip, port, brand: identity.brand, model: identity.model }, 'Device identified');
        return identity;
      }
    } catch {
      // Not Dahua
    }

    // ONVIF fallback
    try {
      const identity = await this.onvif.identify(ip, port);
      if (identity) {
        logger.info({ ip, port, brand: identity.brand, model: identity.model }, 'Device identified via ONVIF');
        return identity;
      }
    } catch {
      // Not ONVIF compliant either
    }

    logger.debug({ ip, port }, 'Device could not be identified by any protocol');
    return null;
  }
}
