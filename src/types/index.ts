// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Core Type Definitions
// ═══════════════════════════════════════════════════════════

// ── Enums ──────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'tenant_admin' | 'operator' | 'viewer' | 'auditor';
export type DeviceType = 'camera' | 'nvr' | 'dvr' | 'encoder' | 'decoder' | 'access_control' | 'intercom' | 'other';
export type DeviceBrand = 'hikvision' | 'dahua' | 'axis' | 'hanwha' | 'uniview' | 'generic_onvif' | 'other';
export type DeviceStatus = 'online' | 'offline' | 'degraded' | 'unknown' | 'maintenance';
export type EventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type EventStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed';
export type IncidentStatus = 'open' | 'investigating' | 'pending' | 'resolved' | 'closed';
export type IncidentPriority = 'critical' | 'high' | 'medium' | 'low';
export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'configuring';
export type MCPConnectorStatus = 'connected' | 'disconnected' | 'error' | 'pending';
export type StreamType = 'main' | 'sub' | 'third';
export type ProtocolType = 'rtsp' | 'onvif' | 'isapi' | 'netsdk' | 'http_api' | 'webrtc';
export type AIProvider = 'openai' | 'anthropic' | 'lovable';
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

// ── Base Entities ──────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  timezone: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  tenant_id: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role: UserRole;
  tenant_id: string;
}

export interface Site {
  id: string;
  tenant_id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  status: HealthStatus;
  created_at: string;
}

export interface DeviceGroup {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  description?: string;
}

export interface Device {
  id: string;
  tenant_id: string;
  site_id: string;
  group_id?: string;
  name: string;
  type: DeviceType;
  brand: DeviceBrand;
  model: string;
  ip_address: string;
  port: number;
  http_port?: number;
  rtsp_port?: number;
  onvif_port?: number;
  serial_number?: string;
  firmware_version?: string;
  mac_address?: string;
  status: DeviceStatus;
  channels: number;
  capabilities: DeviceCapabilities;
  tags: string[];
  notes?: string;
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceCapabilities {
  ptz: boolean;
  audio: boolean;
  smart_events: boolean;
  anpr: boolean;
  face_detection: boolean;
  line_crossing: boolean;
  intrusion_detection: boolean;
  people_counting: boolean;
  codecs: string[];
  max_resolution: string;
  onvif_profiles: string[];
}

export interface Stream {
  id: string;
  device_id: string;
  channel: number;
  type: StreamType;
  codec: string;
  resolution: string;
  fps: number;
  bitrate?: number;
  url_template: string;
  protocol: ProtocolType;
  is_active: boolean;
}

// ── Events & Alarms ────────────────────────────────────────
export interface DeviceEvent {
  id: string;
  tenant_id: string;
  site_id: string;
  device_id: string;
  channel?: number;
  event_type: string;
  severity: EventSeverity;
  status: EventStatus;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  snapshot_url?: string;
  clip_url?: string;
  assigned_to?: string;
  resolved_by?: string;
  resolved_at?: string;
  ai_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  tenant_id: string;
  site_id?: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  assigned_to?: string;
  created_by: string;
  event_ids: string[];
  evidence_urls: string[];
  comments: IncidentComment[];
  ai_summary?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentComment {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

// ── Integrations & MCP ─────────────────────────────────────
export interface Integration {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  provider: string;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  last_sync?: string;
  error_message?: string;
  created_at: string;
}

export interface MCPConnector {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  status: MCPConnectorStatus;
  endpoint?: string;
  scopes: string[];
  health: HealthStatus;
  last_check?: string;
  error_count: number;
  config: Record<string, unknown>;
  created_at: string;
}

// ── AI ─────────────────────────────────────────────────────
export interface AISession {
  id: string;
  tenant_id: string;
  user_id: string;
  provider: AIProvider;
  model: string;
  context_type: string;
  context_id?: string;
  messages: AIMessage[];
  total_tokens: number;
  estimated_cost: number;
  created_at: string;
}

export interface AIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: unknown[];
  tokens?: number;
  latency_ms?: number;
  created_at: string;
}

// ── Audit ──────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ── System Health ──────────────────────────────────────────
export interface SystemHealth {
  component: string;
  status: HealthStatus;
  latency_ms?: number;
  last_check: string;
  details?: Record<string, unknown>;
}

// ── Playback ───────────────────────────────────────────────
export interface PlaybackRequest {
  id: string;
  tenant_id: string;
  device_id: string;
  channel: number;
  start_time: string;
  end_time: string;
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired';
  output_url?: string;
  created_by: string;
  created_at: string;
}

// ── Feature Flags ──────────────────────────────────────────
export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  tenant_override?: Record<string, boolean>;
}

// ── Reports ────────────────────────────────────────────────
export interface Report {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  filters: Record<string, unknown>;
  generated_by: string;
  file_url?: string;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  created_at: string;
}

// ── Layout / UI ────────────────────────────────────────────
export type GridLayout = 1 | 4 | 9 | 16 | 25 | 36;

export interface LiveViewLayout {
  id: string;
  name: string;
  grid: GridLayout;
  slots: LiveViewSlot[];
  is_favorite: boolean;
}

export interface LiveViewSlot {
  position: number;
  device_id?: string;
  channel?: number;
  stream_type: StreamType;
}

// ── Navigation ─────────────────────────────────────────────
export interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
  children?: NavItem[];
  requiredRole?: UserRole;
}
