// ═══════════════════════════════════════════════════════════
// AION Vision Hub — Streaming Contracts
// ═══════════════════════════════════════════════════════════

import type { StreamProfile, StreamState, StreamType } from './adapters.js';

// ── Stream Registration ─────────────────────────────────────

export interface StreamRegistration {
  deviceId: string;
  gatewayId: string;
  siteId: string;
  profiles: StreamProfile[];
  activeProfile: StreamType;
  state: StreamState;
  mediaMtxPath?: string;
  registeredAt: Date;
  lastStateChange: Date;
}

// ── Stream Policy ───────────────────────────────────────────

export type StreamContext = 'mosaic' | 'fullscreen' | 'playback' | 'export' | 'thumbnail';

export interface StreamPolicyConfig {
  mosaic: StreamType;
  fullscreen: StreamType;
  playback: StreamType;
  export: StreamType;
  thumbnail: StreamType;
  fallbackOrder: StreamType[];
  maxConcurrentMainStreams: number;
  maxConcurrentSubStreams: number;
}

export const DEFAULT_STREAM_POLICY: StreamPolicyConfig = {
  mosaic: 'sub',
  fullscreen: 'main',
  playback: 'main',
  export: 'main',
  thumbnail: 'sub',
  fallbackOrder: ['sub', 'main', 'third'],
  maxConcurrentMainStreams: 4,
  maxConcurrentSubStreams: 32,
};

// ── Signed Stream Access ────────────────────────────────────

export interface SignedStreamUrl {
  url: string;
  token: string;
  expiresAt: number;
  protocol: 'rtsp' | 'webrtc' | 'hls';
  deviceId: string;
  streamType: StreamType;
}

// ── MediaMTX Integration ────────────────────────────────────

export interface MediaMTXPathConfig {
  name: string;
  source: string;
  sourceProtocol?: 'udp' | 'tcp' | 'automatic';
  readTimeout?: string;
  writeTimeout?: string;
  runOnReady?: string;
  runOnNotReady?: string;
}

export interface MediaMTXStatus {
  path: string;
  ready: boolean;
  readers: number;
  bytesReceived: number;
  bytesSent: number;
}

// ── Stream State Machine ────────────────────────────────────

export interface StreamStateTransition {
  from: StreamState;
  to: StreamState;
  reason: string;
  timestamp: Date;
}

export const VALID_STREAM_TRANSITIONS: Record<StreamState, StreamState[]> = {
  idle: ['connecting'],
  connecting: ['live', 'failed', 'unauthorized'],
  live: ['degraded', 'reconnecting', 'idle'],
  degraded: ['live', 'reconnecting', 'failed'],
  reconnecting: ['live', 'failed', 'unavailable'],
  failed: ['connecting', 'idle'],
  unauthorized: ['connecting', 'idle'],
  unavailable: ['connecting', 'idle'],
};
