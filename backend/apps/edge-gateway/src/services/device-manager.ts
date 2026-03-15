import type pino from 'pino';
import type { DeviceConnectionConfig, ConnectionResult, ConnectionTestResult, DeviceCapabilities } from '@aion/shared-contracts';
import { AdapterFactory, type FullAdapter } from '@aion/device-adapters';

export interface ManagedDevice {
  deviceId: string;
  brand: string;
  config: DeviceConnectionConfig;
  adapter: FullAdapter;
  connectedAt: Date;
  capabilities?: DeviceCapabilities;
}

/**
 * Manages device connections lifecycle.
 * Routes to the correct adapter based on brand and tracks all active connections.
 */
export class DeviceManager {
  private devices = new Map<string, ManagedDevice>();
  private factory: AdapterFactory;
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ service: 'device-manager' });
    this.factory = new AdapterFactory(logger);
  }

  async connect(config: DeviceConnectionConfig): Promise<ConnectionResult> {
    const adapter = this.factory.get(config.brand);
    const result = await adapter.connect(config);

    if (result.success && result.sessionId) {
      this.devices.set(result.sessionId, {
        deviceId: result.sessionId,
        brand: config.brand,
        config,
        adapter,
        connectedAt: new Date(),
      });

      // Fetch capabilities in background
      this.syncCapabilities(result.sessionId, adapter).catch((err) => {
        this.logger.warn({ deviceId: result.sessionId, err }, 'Failed to sync capabilities');
      });
    }

    return result;
  }

  async testConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    const adapter = this.factory.get(config.brand);
    return adapter.testConnection(config);
  }

  async disconnect(deviceId: string): Promise<void> {
    const managed = this.devices.get(deviceId);
    if (!managed) return;

    await managed.adapter.disconnect(deviceId);
    this.devices.delete(deviceId);
    this.logger.info({ deviceId }, 'Device disconnected and removed');
  }

  getDevice(deviceId: string): ManagedDevice | undefined {
    return this.devices.get(deviceId);
  }

  getAdapter(deviceId: string): FullAdapter | undefined {
    return this.devices.get(deviceId)?.adapter;
  }

  listDevices(): ManagedDevice[] {
    return Array.from(this.devices.values());
  }

  isConnected(deviceId: string): boolean {
    return this.devices.has(deviceId);
  }

  getFactory(): AdapterFactory {
    return this.factory;
  }

  async disconnectAll(): Promise<void> {
    const deviceIds = Array.from(this.devices.keys());
    await Promise.allSettled(deviceIds.map((id) => this.disconnect(id)));
    this.logger.info({ count: deviceIds.length }, 'All devices disconnected');
  }

  private async syncCapabilities(deviceId: string, adapter: FullAdapter): Promise<void> {
    const capabilities = await adapter.getCapabilities(deviceId);
    const managed = this.devices.get(deviceId);
    if (managed) {
      managed.capabilities = capabilities;
      this.logger.debug({ deviceId, capabilities }, 'Capabilities synced');
    }
  }
}
