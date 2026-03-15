import type { DiscoveredDevice } from '@aion/shared-contracts';
import type pino from 'pino';

/**
 * ONVIF WS-Discovery probe implementation.
 * Uses the `onvif` npm package for WS-Discovery multicast probes
 * following ONVIF specification.
 */
export async function wsDiscovery(
  networkRange: string,
  timeout: number,
  logger: pino.Logger,
): Promise<DiscoveredDevice[]> {
  logger.info({ networkRange, timeout }, 'Starting ONVIF WS-Discovery probe');

  try {
    const { Discovery } = await import('onvif');
    const devices: DiscoveredDevice[] = [];

    await new Promise<void>((resolve) => {
      const discovery = new Discovery();

      discovery.on('device', (cam: Record<string, unknown>) => {
        const hostname = (cam.hostname ?? cam.address ?? '') as string;
        const port = (cam.port ?? 80) as number;
        const deviceInfo = cam.deviceInformation as Record<string, string> | undefined;

        if (hostname) {
          devices.push({
            ip: hostname,
            port,
            brand: 'onvif',
            model: deviceInfo?.model ?? 'Unknown',
            serial: deviceInfo?.serialNumber,
            mac: deviceInfo?.macAddress,
            protocols: ['onvif', 'rtsp'],
          });
        }
      });

      discovery.on('error', (err: Error) => {
        logger.error({ err }, 'WS-Discovery error');
      });

      discovery.probe();

      setTimeout(() => {
        discovery.removeAllListeners();
        resolve();
      }, timeout);
    });

    logger.info({ count: devices.length }, 'WS-Discovery complete');
    return devices;
  } catch (err) {
    logger.error({ err }, 'WS-Discovery failed');
    return [];
  }
}
