// ═══════════════════════════════════════════════════════════
// AION Vision Hub — Business Domain Types
// ═══════════════════════════════════════════════════════════

// ── Tenant ──────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'professional' | 'enterprise';
  settings: TenantSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  maxDevices: number;
  maxUsers: number;
  maxSites: number;
  retentionDays: number;
  features: string[];
  aiEnabled: boolean;
  aiProviders: string[];
}

// ── User ────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'tenant_admin' | 'operator' | 'viewer' | 'auditor';

export interface User {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  role: UserRole;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Device ──────────────────────────────────────────────────

export type DeviceStatus = 'online' | 'offline' | 'degraded' | 'maintenance' | 'unknown';
export type DeviceBrand = 'hikvision' | 'dahua' | 'onvif' | 'generic';
export type DeviceType = 'camera' | 'nvr' | 'dvr' | 'encoder' | 'decoder' | 'access_control' | 'intercom';

export interface Device {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  brand: DeviceBrand;
  model: string;
  type: DeviceType;
  ip: string;
  port: number;
  rtspUrl?: string;
  status: DeviceStatus;
  channels: number;
  firmware?: string;
  serial?: string;
  mac?: string;
  credentialRef: string;
  gatewayId?: string;
  tags: string[];
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Site ────────────────────────────────────────────────────

export interface Site {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  gatewayId?: string;
  isActive: boolean;
  deviceCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Event ───────────────────────────────────────────────────

export type EventSeverity = 'info' | 'warning' | 'critical';
export type EventStatus = 'new' | 'acknowledged' | 'resolved' | 'dismissed';

export interface DeviceEvent {
  id: string;
  tenantId: string;
  deviceId: string;
  siteId: string;
  type: string;
  severity: EventSeverity;
  status: EventStatus;
  title: string;
  description?: string;
  channel?: number;
  snapshotUrl?: string;
  assignedTo?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ── Incident ────────────────────────────────────────────────

export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  siteId?: string;
  assignedTo?: string;
  eventIds: string[];
  evidence: IncidentEvidence[];
  comments: IncidentComment[];
  resolvedAt?: Date;
  closedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentEvidence {
  id: string;
  type: 'snapshot' | 'clip' | 'log' | 'note';
  url?: string;
  content?: string;
  addedBy: string;
  addedAt: Date;
}

export interface IncidentComment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

// ── Integration ─────────────────────────────────────────────

export type IntegrationType = 'webhook' | 'whatsapp' | 'email' | 'sms' | 'slack' | 'mcp' | 'custom';

export interface Integration {
  id: string;
  tenantId: string;
  name: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  isActive: boolean;
  lastTestedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── AI Bridge ───────────────────────────────────────────────

export interface AIChatParams {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIChatResponse {
  content: string;
  model: string;
  provider: string;
  tokens: { prompt: number; completion: number };
  finishReason: string;
}

export interface AIChatChunk {
  content: string;
  done: boolean;
}

export interface AIUsageRecord {
  tenantId: string;
  provider: string;
  model: string;
  tokens: number;
  cost: number;
  context: string;
  createdAt: Date;
}

// ── MCP Bridge ──────────────────────────────────────────────

export interface MCPConnector {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  endpoint: string;
  tools: MCPTool[];
  isActive: boolean;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  connectorId: string;
}

export interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionMs: number;
}

// ── Report ──────────────────────────────────────────────────

export type ReportType = 'events' | 'incidents' | 'devices' | 'access' | 'audit' | 'custom';
export type ReportFormat = 'json' | 'csv' | 'pdf';

export interface Report {
  id: string;
  tenantId: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  parameters: Record<string, unknown>;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  outputUrl?: string;
  generatedAt?: Date;
  createdBy: string;
  createdAt: Date;
}

// ── Audit Log ───────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ── Gateway Registration ────────────────────────────────────

export interface GatewayInfo {
  id: string;
  siteId: string;
  tenantId: string;
  hostname: string;
  version: string;
  status: 'online' | 'offline' | 'degraded';
  connectedDevices: number;
  lastHeartbeat: Date;
  publicIp?: string;
  localIp: string;
  capabilities: string[];
}
