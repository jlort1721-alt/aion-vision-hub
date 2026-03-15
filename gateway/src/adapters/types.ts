// ── Device Adapter Interfaces (mirrors production-contracts.ts) ──

export interface DeviceConnectionConfig {
  ip: string;
  port: number;
  username: string;
  password: string;
  brand: string;
  protocol?: string;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
  sessionId?: string;
  capabilities?: DeviceCapabilities;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  capabilities?: DeviceCapabilities;
  deviceInfo?: DeviceIdentity;
}

export interface DiscoveredDevice {
  ip: string;
  port: number;
  brand: string;
  model: string;
  serial?: string;
  mac?: string;
  firmware?: string;
  protocols: string[];
}

export interface DeviceIdentity {
  brand: string;
  model: string;
  serial: string;
  firmware: string;
  mac?: string;
  channels?: number;
}

export interface StreamProfile {
  type: 'main' | 'sub' | 'third';
  url: string;
  codec: string;
  resolution: string;
  fps: number;
  bitrate?: number;
  channel: number;
}

export type StreamState =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'degraded'
  | 'reconnecting'
  | 'failed'
  | 'unauthorized'
  | 'unavailable';

export interface DeviceCapabilities {
  ptz: boolean;
  audio: boolean;
  smartEvents: boolean;
  anpr: boolean;
  faceDetection: boolean;
  channels: number;
  codecs: string[];
  maxResolution: string;
  twoWayAudio: boolean;
  onvifSupport: boolean;
  localStorage: boolean;
}

export interface DeviceSystemInfo {
  firmware: string;
  uptime: number;
  storage?: { total: number; used: number; free: number };
  network?: Record<string, unknown>;
}

export interface DeviceHealthReport {
  online: boolean;
  latencyMs: number;
  cpuUsage?: number;
  memoryUsage?: number;
  storageUsage?: number;
  uptime?: number;
  errors: string[];
  lastChecked: string;
}

export interface PTZCommand {
  action: 'left' | 'right' | 'up' | 'down' | 'zoomin' | 'zoomout' | 'stop'
    | 'goto_preset' | 'set_preset' | 'iris_open' | 'iris_close'
    | 'focus_near' | 'focus_far' | 'auto_focus';
  speed?: number;
  presetId?: number;
  channel?: number;
}

export interface PTZPreset {
  id: number;
  name: string;
  position?: { pan: number; tilt: number; zoom: number };
}

export interface PTZStatus {
  pan: number;
  tilt: number;
  zoom: number;
  moving: boolean;
}

// ── Playback types ──

export interface RecordingSegment {
  startTime: string;
  endTime: string;
  channel: number;
  type: 'continuous' | 'event' | 'manual';
  sizeBytes?: number;
}

export interface PlaybackRequest {
  deviceId: string;
  channel: number;
  startTime: string;
  endTime: string;
  streamType?: 'main' | 'sub';
}

export interface PlaybackResult {
  rtspUrl: string;
  webrtcUrl?: string;
  hlsUrl?: string;
  durationSeconds: number;
}

export interface RecordingSearchResult {
  segments: RecordingSegment[];
  totalCount: number;
  totalDurationSeconds: number;
}

// ── Event types ──

export interface DeviceEvent {
  eventType: string;
  channel: number;
  timestamp: string;
  data?: Record<string, unknown>;
}

export type EventCallback = (event: DeviceEvent, deviceId: string) => void;

// ── Adapter Interfaces ──

export interface IDeviceAdapter {
  readonly brand: string;
  readonly supportedProtocols: string[];
  connect(config: DeviceConnectionConfig): Promise<ConnectionResult>;
  disconnect(deviceId: string): Promise<void>;
  testConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult>;
}

export interface IDiscoveryAdapter {
  discover(networkRange: string, timeout?: number): Promise<DiscoveredDevice[]>;
  identify(ip: string, port: number): Promise<DeviceIdentity | null>;
}

export interface IStreamAdapter {
  getStreams(deviceId: string): Promise<StreamProfile[]>;
  getStreamUrl(deviceId: string, type: 'main' | 'sub', channel?: number): string;
  getStreamState(deviceId: string): StreamState;
}

export interface IPTZAdapter {
  sendCommand(deviceId: string, command: PTZCommand): Promise<void>;
  getPresets(deviceId: string): Promise<PTZPreset[]>;
  setPreset(deviceId: string, preset: PTZPreset): Promise<void>;
  getStatus?(deviceId: string): Promise<PTZStatus>;
}

export interface IHealthAdapter {
  getHealth(deviceId: string): Promise<DeviceHealthReport>;
  ping(ip: string, port: number): Promise<{ reachable: boolean; latencyMs: number }>;
}

export interface IPlaybackAdapter {
  searchRecordings(deviceId: string, channel: number, start: string, end: string): Promise<RecordingSearchResult>;
  getPlaybackUrl(deviceId: string, channel: number, start: string, end: string): string;
}

export interface IEventAdapter {
  startEventListener(deviceId: string, callback: EventCallback): void;
  stopEventListener(deviceId: string): void;
}
