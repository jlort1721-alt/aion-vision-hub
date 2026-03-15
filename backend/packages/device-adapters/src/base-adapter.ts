import type pino from 'pino';
import type {
  DeviceConnectionConfig,
  ConnectionResult,
  ConnectionTestResult,
  StreamProfile,
  StreamState,
  DeviceHealthReport,
  DeviceCapabilities,
  DeviceSystemInfo,
  IDeviceAdapter,
  IStreamAdapter,
  IHealthAdapter,
  IConfigAdapter,
} from '@aion/shared-contracts';

export interface DeviceConnection {
  deviceId: string;
  config: DeviceConnectionConfig;
  state: StreamState;
  connectedAt: Date;
  lastHealthCheck?: Date;
  capabilities?: DeviceCapabilities;
}

/**
 * Abstract base class for device adapters.
 * Provides shared connection tracking, state management, and error handling.
 * Concrete adapters (Hikvision, Dahua, ONVIF) extend this class.
 */
export abstract class BaseAdapter implements IDeviceAdapter, IStreamAdapter, IHealthAdapter, IConfigAdapter {
  abstract readonly brand: string;
  abstract readonly supportedProtocols: string[];

  protected connections = new Map<string, DeviceConnection>();
  protected logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  // ── IDeviceAdapter (template methods) ─────────────────────

  async connect(config: DeviceConnectionConfig): Promise<ConnectionResult> {
    const deviceId = this.generateDeviceId(config);
    try {
      const result = await this.doConnect(config, deviceId);
      if (result.success) {
        this.connections.set(deviceId, {
          deviceId,
          config,
          state: 'live',
          connectedAt: new Date(),
        });
        this.logger.info({ deviceId }, 'Device connected');
      }
      return { ...result, sessionId: deviceId };
    } catch (err) {
      this.connections.set(deviceId, {
        deviceId,
        config,
        state: 'failed',
        connectedAt: new Date(),
      });
      const message = err instanceof Error ? err.message : 'Connection failed';
      this.logger.error({ deviceId, err }, 'Connection failed');
      return { success: false, message };
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    await this.doDisconnect(deviceId);
    this.connections.delete(deviceId);
    this.logger.info({ deviceId }, 'Device disconnected');
  }

  async testConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const result = await this.doTestConnection(config);
      return { ...result, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  // ── IStreamAdapter ────────────────────────────────────────

  abstract getStreams(deviceId: string): Promise<StreamProfile[]>;

  abstract getStreamUrl(deviceId: string, type: 'main' | 'sub', channel?: number): string;

  async registerStream(_deviceId: string, _profile: StreamProfile): Promise<void> {
    // Default no-op — gateway stream-manager handles registration
  }

  getStreamState(deviceId: string): StreamState {
    return this.connections.get(deviceId)?.state ?? 'idle';
  }

  // ── IHealthAdapter ────────────────────────────────────────

  abstract getHealth(deviceId: string): Promise<DeviceHealthReport>;

  async ping(ip: string, port: number): Promise<{ reachable: boolean; latencyMs: number }> {
    const { request } = await import('undici');
    const start = Date.now();
    try {
      await request(`http://${ip}:${port}/`, { method: 'HEAD', headersTimeout: 3000 });
      return { reachable: true, latencyMs: Date.now() - start };
    } catch {
      return { reachable: false, latencyMs: Date.now() - start };
    }
  }

  // ── IConfigAdapter ────────────────────────────────────────

  abstract getCapabilities(deviceId: string): Promise<DeviceCapabilities>;
  abstract getSystemInfo(deviceId: string): Promise<DeviceSystemInfo>;

  async setConfig(_deviceId: string, _config: Record<string, unknown>): Promise<void> {
    throw new Error('setConfig not supported by this adapter');
  }

  // ── Shared Helpers ────────────────────────────────────────

  protected getConnection(deviceId: string): DeviceConnection | undefined {
    return this.connections.get(deviceId);
  }

  protected requireConnection(deviceId: string): DeviceConnection {
    const conn = this.connections.get(deviceId);
    if (!conn) throw new Error(`Device ${deviceId} not connected`);
    return conn;
  }

  protected updateState(deviceId: string, state: StreamState): void {
    const conn = this.connections.get(deviceId);
    if (conn) {
      conn.state = state;
      this.logger.debug({ deviceId, state }, 'Device state changed');
    }
  }

  protected generateDeviceId(config: DeviceConnectionConfig): string {
    const prefix = this.brand.substring(0, 3);
    return `${prefix}-${config.ip}:${config.port}`;
  }

  getConnectedDevices(): string[] {
    return Array.from(this.connections.keys());
  }

  isConnected(deviceId: string): boolean {
    return this.connections.has(deviceId);
  }

  // ── Abstract Template Methods ─────────────────────────────

  protected abstract doConnect(config: DeviceConnectionConfig, deviceId: string): Promise<ConnectionResult>;
  protected abstract doDisconnect(deviceId: string): Promise<void>;
  protected abstract doTestConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult>;
}
