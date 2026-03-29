// ═══════════════════════════════════════════════════════════
// AION Vision Hub — Device Adapter Contracts
// ═══════════════════════════════════════════════════════════

// ── Connection Types ────────────────────────────────────────

export interface DeviceConnectionConfig {
  ip: string;
  port: number;
  username: string;
  password: string;
  brand: string;
  protocol?: string;
  channels?: number;
  useTls?: boolean;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
  sessionId?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  capabilities?: DeviceCapabilities;
}

export interface DiscoveredDevice {
  ip: string;
  port: number;
  brand: string;
  model: string;
  serial?: string;
  mac?: string;
  protocols: string[];
}

export interface DeviceIdentity {
  brand: string;
  model: string;
  serial: string;
  firmware: string;
}

// ── Stream Types ────────────────────────────────────────────

export type StreamType = 'main' | 'sub' | 'third';

export interface StreamProfile {
  type: StreamType;
  url: string;
  codec: string;
  resolution: string;
  fps: number;
  bitrate?: number;
  channel?: number;
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

// ── Device Capabilities ─────────────────────────────────────

export interface DeviceCapabilities {
  ptz: boolean;
  audio: boolean;
  smartEvents: boolean;
  anpr: boolean;
  faceDetection: boolean;
  channels: number;
  codecs: string[];
  maxResolution: string;
  playback: boolean;
  twoWayAudio: boolean;
}

export interface DeviceSystemInfo {
  firmware: string;
  uptime: number;
  storage?: { total: number; used: number };
  network?: Record<string, unknown>;
  model?: string;
  serial?: string;
}

export interface DeviceHealthReport {
  online: boolean;
  latencyMs: number;
  cpuUsage?: number;
  memoryUsage?: number;
  storageUsage?: number;
  errors: string[];
  lastChecked: Date;
}

// ── PTZ Types ───────────────────────────────────────────────

export interface PTZCommand {
  action: 'left' | 'right' | 'up' | 'down' | 'zoomin' | 'zoomout' | 'stop' | 'goto_preset';
  speed?: number;
  presetId?: number;
  duration?: number;
}

export interface PTZPreset {
  id: number;
  name: string;
  position?: { pan: number; tilt: number; zoom: number };
}

// ── Playback Types ──────────────────────────────────────────

export interface PlaybackSearchParams {
  deviceId: string;
  channel: number;
  startTime: Date;
  endTime: Date;
  eventType?: string;
}

export interface PlaybackSegment {
  startTime: Date;
  endTime: Date;
  type: 'continuous' | 'motion' | 'alarm';
  sizeBytes?: number;
}

export interface PlaybackStartParams {
  deviceId: string;
  channel: number;
  startTime: Date;
  speed?: number;
}

export interface PlaybackSession {
  sessionId: string;
  streamUrl: string;
  deviceId: string;
  channel: number;
}

export interface ClipExportParams {
  deviceId: string;
  channel: number;
  startTime: Date;
  endTime: Date;
  format?: 'mp4' | 'avi' | 'mkv';
}

export interface ExportJob {
  jobId: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  progress?: number;
  outputUrl?: string;
  error?: string;
}

// ── Event Types ─────────────────────────────────────────────

export interface DeviceEventPayload {
  deviceId: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  channel?: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export type Unsubscribe = () => void;

// ── Adapter Interfaces ──────────────────────────────────────

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
  getStreamUrl(deviceId: string, type: StreamType, channel?: number): string;
  registerStream(deviceId: string, profile: StreamProfile): Promise<void>;
  getStreamState(deviceId: string): StreamState;
}

export interface IPlaybackAdapter {
  search(params: PlaybackSearchParams): Promise<PlaybackSegment[]>;
  startPlayback(params: PlaybackStartParams): Promise<PlaybackSession>;
  stopPlayback(sessionId: string): Promise<void>;
  exportClip(params: ClipExportParams): Promise<ExportJob>;
  getSnapshot(deviceId: string, timestamp: Date, channel?: number): Promise<Uint8Array>;
}

export interface IEventAdapter {
  subscribe(deviceId: string, callback: (event: DeviceEventPayload) => void): Promise<Unsubscribe>;
  getEventTypes(deviceId: string): Promise<string[]>;
}

export interface IPTZAdapter {
  sendCommand(deviceId: string, command: PTZCommand): Promise<void>;
  getPresets(deviceId: string): Promise<PTZPreset[]>;
  setPreset(deviceId: string, preset: PTZPreset): Promise<void>;
  startPatrol(deviceId: string, patrolId: number): Promise<void>;
  stopPatrol(deviceId: string): Promise<void>;
}

export interface IConfigAdapter {
  getCapabilities(deviceId: string): Promise<DeviceCapabilities>;
  getSystemInfo(deviceId: string): Promise<DeviceSystemInfo>;
  setConfig(deviceId: string, config: Record<string, unknown>): Promise<void>;
}

export interface IHealthAdapter {
  getHealth(deviceId: string): Promise<DeviceHealthReport>;
  ping(ip: string, port: number): Promise<{ reachable: boolean; latencyMs: number }>;
}

// ── Composite Adapter Interface ─────────────────────────────

export interface IFullDeviceAdapter extends
  IDeviceAdapter,
  IStreamAdapter,
  IDiscoveryAdapter,
  IPlaybackAdapter,
  IEventAdapter,
  IPTZAdapter,
  IConfigAdapter,
  IHealthAdapter {}
