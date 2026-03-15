// ═══════════════════════════════════════════════════════════
// AION Vision Hub — API Request/Response Contracts
// ═══════════════════════════════════════════════════════════

// ── Generic API Types ───────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  siteId?: string;
  from?: string;
  to?: string;
}

// ── Auth ────────────────────────────────────────────────────

export interface TokenVerifyRequest {
  token: string;
}

export interface TokenVerifyResponse {
  valid: boolean;
  userId: string;
  tenantId: string;
  role: string;
  expiresAt: number;
}

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ── Devices ─────────────────────────────────────────────────

export interface CreateDeviceRequest {
  name: string;
  brand: string;
  model: string;
  type: string;
  ip: string;
  port: number;
  siteId: string;
  username: string;
  password: string;
  channels?: number;
  tags?: string[];
}

export interface UpdateDeviceRequest {
  name?: string;
  siteId?: string;
  tags?: string[];
  status?: string;
}

export interface TestDeviceRequest {
  ip: string;
  port: number;
  username: string;
  password: string;
  brand: string;
}

// ── Events ──────────────────────────────────────────────────

export interface CreateEventRequest {
  deviceId: string;
  type: string;
  severity: string;
  title: string;
  description?: string;
  channel?: number;
  snapshotUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AssignEventRequest {
  assignedTo: string;
}

export interface EventFilterParams extends FilterParams, PaginationParams {
  severity?: string;
  deviceId?: string;
  assignedTo?: string;
}

// ── Incidents ───────────────────────────────────────────────

export interface CreateIncidentRequest {
  title: string;
  description: string;
  priority: string;
  siteId?: string;
  eventIds?: string[];
}

export interface UpdateIncidentRequest {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
}

export interface AddEvidenceRequest {
  type: string;
  url?: string;
  content?: string;
}

export interface AddCommentRequest {
  content: string;
}

// ── Streams ─────────────────────────────────────────────────

export interface RegisterStreamRequest {
  deviceId: string;
  gatewayId: string;
  profiles: Array<{
    type: string;
    url: string;
    codec: string;
    resolution: string;
    fps: number;
  }>;
}

export interface StreamUrlRequest {
  type: 'main' | 'sub';
  channel?: number;
  protocol?: 'rtsp' | 'webrtc' | 'hls';
}

export interface StreamUrlResponse {
  url: string;
  token: string;
  expiresAt: number;
  protocol: string;
}

// ── Sites ───────────────────────────────────────────────────

export interface CreateSiteRequest {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface UpdateSiteRequest {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isActive?: boolean;
}

// ── Users ───────────────────────────────────────────────────

export interface CreateUserRequest {
  email: string;
  fullName: string;
  role: string;
  password: string;
}

export interface UpdateUserRequest {
  fullName?: string;
  role?: string;
  isActive?: boolean;
  avatarUrl?: string;
}

// ── Tenants ─────────────────────────────────────────────────

export interface CreateTenantRequest {
  name: string;
  slug: string;
  plan?: string;
}

export interface UpdateTenantRequest {
  name?: string;
  plan?: string;
  settings?: Record<string, unknown>;
  isActive?: boolean;
}

// ── Reports ─────────────────────────────────────────────────

export interface CreateReportRequest {
  name: string;
  type: string;
  format?: string;
  parameters: Record<string, unknown>;
}

// ── Integrations ────────────────────────────────────────────

export interface CreateIntegrationRequest {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface UpdateIntegrationRequest {
  name?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

// ── AI Bridge ───────────────────────────────────────────────

export interface AIChatRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
}

// ── MCP Bridge ──────────────────────────────────────────────

export interface MCPExecuteRequest {
  toolName: string;
  params: Record<string, unknown>;
}

// ── Audit ───────────────────────────────────────────────────

export interface AuditFilterParams extends PaginationParams {
  userId?: string;
  action?: string;
  resource?: string;
  from?: string;
  to?: string;
}

// ── Health ──────────────────────────────────────────────────

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, {
    status: 'up' | 'down';
    latencyMs?: number;
    message?: string;
  }>;
}

// ── Gateway API ─────────────────────────────────────────────

export interface GatewayConnectRequest {
  ip: string;
  port: number;
  username: string;
  password: string;
  brand: string;
  protocol?: string;
}

export interface GatewayDiscoverRequest {
  networkRange: string;
  timeout?: number;
  brands?: string[];
}

export interface GatewayPTZRequest {
  action: string;
  speed?: number;
  presetId?: number;
  duration?: number;
}

export interface GatewayPlaybackSearchRequest {
  channel: number;
  startTime: string;
  endTime: string;
  eventType?: string;
}

export interface GatewayPlaybackStartRequest {
  channel: number;
  startTime: string;
  speed?: number;
}

export interface GatewayExportRequest {
  channel: number;
  startTime: string;
  endTime: string;
  format?: string;
}
