import { logger } from '../utils/logger.js';
import { HikvisionAdapter } from '../adapters/hikvision/adapter.js';
import { DahuaAdapter } from '../adapters/dahua/adapter.js';
import { OnvifAdapter } from '../adapters/onvif/adapter.js';
import type {
  IDeviceAdapter,
  IStreamAdapter,
  IHealthAdapter,
  IPTZAdapter,
  IPlaybackAdapter,
  IEventAdapter,
  DeviceConnectionConfig,
  ConnectionResult,
  ConnectionTestResult,
  StreamProfile,
  StreamState,
  DeviceHealthReport,
  PTZCommand,
  PTZPreset,
} from '../adapters/types.js';

type FullAdapter = IDeviceAdapter &
  Partial<IStreamAdapter & IHealthAdapter & IPTZAdapter & IPlaybackAdapter & IEventAdapter>;

export interface ManagedDevice {
  id: string;
  config: DeviceConnectionConfig;
  adapter: FullAdapter;
  connectedAt?: Date;
  tenantId?: string;
}

/**
 * DeviceManager — central registry for all connected devices.
 *
 * Routes operations to the correct brand adapter (Hikvision, Dahua, or ONVIF fallback).
 * Stores connected device state and exposes operations via deviceId lookup.
 */
export class DeviceManager {
  private devices = new Map<string, ManagedDevice>();
  private adapters: Record<string, FullAdapter>;

  constructor() {
    const hik = new HikvisionAdapter();
    const dahua = new DahuaAdapter();
    const onvif = new OnvifAdapter();

    this.adapters = {
      hikvision: hik,
      dahua: dahua,
      onvif: onvif,
      'onvif-generic': onvif,
    };
  }

  getAdapter(brand: string): FullAdapter {
    return this.adapters[brand.toLowerCase()] || this.adapters.onvif;
  }

  async connect(cfg: DeviceConnectionConfig, tenantId?: string): Promise<ConnectionResult> {
    const adapter = this.getAdapter(cfg.brand);
    const result = await adapter.connect(cfg);
    if (result.success && result.sessionId) {
      this.devices.set(result.sessionId, {
        id: result.sessionId,
        config: cfg,
        adapter,
        connectedAt: new Date(),
        tenantId,
      });
      logger.info({ deviceId: result.sessionId, brand: cfg.brand }, 'Device registered');
    }
    return result;
  }

  async disconnect(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device) {
      await device.adapter.disconnect(deviceId);
      this.devices.delete(deviceId);
    }
  }

  async testConnection(cfg: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    const adapter = this.getAdapter(cfg.brand);
    return adapter.testConnection(cfg);
  }

  // ── Stream operations ──

  async getStreams(deviceId: string): Promise<StreamProfile[]> {
    const device = this.devices.get(deviceId);
    if (!device?.adapter.getStreams) return [];
    return device.adapter.getStreams(deviceId);
  }

  getStreamUrl(deviceId: string, type: 'main' | 'sub', channel?: number): string {
    const device = this.devices.get(deviceId);
    if (!device?.adapter.getStreamUrl) return '';
    return device.adapter.getStreamUrl(deviceId, type, channel);
  }

  getStreamState(deviceId: string): StreamState {
    const device = this.devices.get(deviceId);
    if (!device?.adapter.getStreamState) return 'idle';
    return device.adapter.getStreamState(deviceId);
  }

  // ── Health operations ──

  async getHealth(deviceId: string): Promise<DeviceHealthReport> {
    const device = this.devices.get(deviceId);
    if (!device?.adapter.getHealth) {
      return { online: false, latencyMs: -1, errors: ['Device not found or adapter missing health'], lastChecked: new Date().toISOString() };
    }
    return device.adapter.getHealth(deviceId);
  }

  // ── PTZ operations ──

  async sendPTZCommand(deviceId: string, command: PTZCommand): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    const adapter = device.adapter as Partial<IPTZAdapter>;
    if (typeof adapter.sendCommand !== 'function') {
      throw new Error(`Device ${deviceId} does not support PTZ`);
    }
    await adapter.sendCommand(deviceId, command);
  }

  async getPTZPresets(deviceId: string): Promise<PTZPreset[]> {
    const device = this.devices.get(deviceId);
    if (!device) return [];
    const adapter = device.adapter as Partial<IPTZAdapter>;
    if (typeof adapter.getPresets !== 'function') return [];
    return adapter.getPresets(deviceId);
  }

  async setPTZPreset(deviceId: string, preset: PTZPreset): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    const adapter = device.adapter as Partial<IPTZAdapter>;
    if (typeof adapter.setPreset !== 'function') {
      throw new Error(`Device ${deviceId} does not support PTZ presets`);
    }
    await adapter.setPreset(deviceId, preset);
  }

  // ── Query ──

  listConnected(): Array<{ id: string; brand: string; ip: string; connectedAt?: Date; tenantId?: string }> {
    return Array.from(this.devices.values()).map((d) => ({
      id: d.id,
      brand: d.config.brand,
      ip: d.config.ip,
      connectedAt: d.connectedAt,
      tenantId: d.tenantId,
    }));
  }

  getDevice(deviceId: string): ManagedDevice | undefined {
    return this.devices.get(deviceId);
  }

  getDeviceCount(): number {
    return this.devices.size;
  }
}
