// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Device Adapter Contracts
// ═══════════════════════════════════════════════════════════

import { Device, DeviceCapabilities, DeviceEvent, Stream, ProtocolType } from './index';

/** Connection credentials for a device */
export interface DeviceCredentials {
  username: string;
  password: string;
  token?: string;
}

/** Result of a device discovery scan */
export interface DiscoveredDevice {
  ip_address: string;
  port: number;
  brand: string;
  model: string;
  serial_number?: string;
  mac_address?: string;
  protocols: ProtocolType[];
}

/** PTZ command structure */
export interface PTZCommand {
  action: 'up' | 'down' | 'left' | 'right' | 'zoom_in' | 'zoom_out' | 'stop' |
          'goto_preset' | 'set_preset' | 'start_patrol' | 'stop_patrol';
  speed?: number;
  preset_id?: number;
  patrol_id?: number;
}

/** Common adapter interface for all device brands */
export interface IDeviceAdapter {
  readonly brand: string;
  readonly supportedProtocols: ProtocolType[];

  // Connection
  connect(device: Device, credentials: DeviceCredentials): Promise<boolean>;
  disconnect(deviceId: string): Promise<void>;
  testConnection(device: Device, credentials: DeviceCredentials): Promise<{ success: boolean; message: string }>;

  // Discovery
  discover(networkRange: string, timeout?: number): Promise<DiscoveredDevice[]>;

  // Capabilities
  getCapabilities(device: Device): Promise<DeviceCapabilities>;

  // Streams
  getStreams(device: Device): Promise<Stream[]>;
  getStreamUrl(device: Device, streamType: 'main' | 'sub', channel?: number): string;

  // PTZ
  sendPTZCommand(device: Device, command: PTZCommand): Promise<void>;
  getPTZPresets(device: Device): Promise<Array<{ id: number; name: string }>>;

  // Events
  subscribeEvents(device: Device, callback: (event: DeviceEvent) => void): Promise<() => void>;

  // Status
  getStatus(device: Device): Promise<{ online: boolean; details: Record<string, unknown> }>;

  // Snapshots
  getSnapshot(device: Device, channel?: number): Promise<Blob>;
}

/** Hikvision-specific adapter (ISAPI + Device Network SDK) */
export interface IHikvisionAdapter extends IDeviceAdapter {
  getISAPIEndpoint(device: Device, path: string): Promise<unknown>;
  getSmartEvents(device: Device): Promise<DeviceEvent[]>;
}

/** Dahua-specific adapter (HTTP API + NetSDK) */
export interface IDahuaAdapter extends IDeviceAdapter {
  getHTTPAPIEndpoint(device: Device, path: string): Promise<unknown>;
  getSmartSearch(device: Device, params: Record<string, unknown>): Promise<unknown>;
}

/** Generic ONVIF adapter */
export interface IOnvifAdapter extends IDeviceAdapter {
  getProfiles(device: Device): Promise<unknown[]>;
  getEventSubscription(device: Device): Promise<unknown>;
}
