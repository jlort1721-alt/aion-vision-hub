// ═══════════════════════════════════════════════════════════
// AION Vision Hub — Event & Messaging Contracts
// ═══════════════════════════════════════════════════════════

// ── Gateway → Backend Events ────────────────────────────────

export interface GatewayEvent {
  type: GatewayEventType;
  gatewayId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export type GatewayEventType =
  | 'device.connected'
  | 'device.disconnected'
  | 'device.health_changed'
  | 'stream.state_changed'
  | 'event.detected'
  | 'discovery.completed'
  | 'gateway.heartbeat'
  | 'gateway.error';

// ── Device Event Types ──────────────────────────────────────

export const DEVICE_EVENT_TYPES = {
  MOTION_DETECTED: 'motion_detected',
  LINE_CROSSING: 'line_crossing',
  INTRUSION: 'intrusion',
  FACE_DETECTED: 'face_detected',
  PLATE_DETECTED: 'plate_detected',
  TAMPER: 'tamper',
  VIDEO_LOSS: 'video_loss',
  STORAGE_FULL: 'storage_full',
  NETWORK_ERROR: 'network_error',
  IO_ALARM: 'io_alarm',
  TEMPERATURE: 'temperature',
  AUDIO_DETECTED: 'audio_detected',
} as const;

export type DeviceEventType = typeof DEVICE_EVENT_TYPES[keyof typeof DEVICE_EVENT_TYPES];

// ── WebSocket Messages ──────────────────────────────────────

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: string;
}

export type WSMessageType =
  | 'event.new'
  | 'device.status'
  | 'stream.state'
  | 'alert.triggered'
  | 'ping'
  | 'pong';

export interface WSEventMessage {
  type: 'event.new';
  payload: {
    deviceId: string;
    eventType: string;
    severity: string;
    channel?: number;
    metadata: Record<string, unknown>;
  };
  timestamp: string;
}

export interface WSDeviceStatusMessage {
  type: 'device.status';
  payload: {
    deviceId: string;
    status: string;
    latencyMs: number;
  };
  timestamp: string;
}

export interface WSStreamStateMessage {
  type: 'stream.state';
  payload: {
    deviceId: string;
    streamType: string;
    state: string;
  };
  timestamp: string;
}
