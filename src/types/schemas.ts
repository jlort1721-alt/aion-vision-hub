// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Zod Validation Schemas
// Runtime type validation for API data and forms
// ═══════════════════════════════════════════════════════════

import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────

export const UserRoleSchema = z.enum(['super_admin', 'tenant_admin', 'operator', 'viewer', 'auditor']);
export const DeviceTypeSchema = z.enum(['camera', 'nvr', 'dvr', 'encoder', 'decoder', 'access_control', 'intercom', 'other']);
export const DeviceBrandSchema = z.enum(['hikvision', 'dahua', 'axis', 'hanwha', 'uniview', 'generic_onvif', 'other']);
export const DeviceStatusSchema = z.enum(['online', 'offline', 'degraded', 'unknown', 'maintenance']);
export const EventSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const EventStatusSchema = z.enum(['new', 'acknowledged', 'investigating', 'resolved', 'dismissed']);
export const IncidentStatusSchema = z.enum(['open', 'investigating', 'pending', 'resolved', 'closed']);
export const IncidentPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'down', 'unknown']);

// ── Device Schemas ─────────────────────────────────────────

export const DeviceCapabilitiesSchema = z.object({
  ptz: z.boolean().default(false),
  audio: z.boolean().default(false),
  smart_events: z.boolean().default(false),
  anpr: z.boolean().default(false),
  face_detection: z.boolean().default(false),
  line_crossing: z.boolean().default(false),
  intrusion_detection: z.boolean().default(false),
  people_counting: z.boolean().default(false),
  codecs: z.array(z.string()).default([]),
  max_resolution: z.string().default(''),
  onvif_profiles: z.array(z.string()).default([]),
});

export const DeviceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  site_id: z.string().uuid(),
  group_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  type: DeviceTypeSchema,
  brand: DeviceBrandSchema,
  model: z.string().max(200).default(''),
  ip_address: z.string(),
  port: z.number().int().min(1).max(65535).default(554),
  http_port: z.number().int().min(1).max(65535).optional(),
  rtsp_port: z.number().int().min(1).max(65535).optional(),
  onvif_port: z.number().int().min(1).max(65535).optional(),
  serial_number: z.string().optional(),
  firmware_version: z.string().optional(),
  mac_address: z.string().optional(),
  status: DeviceStatusSchema,
  channels: z.number().int().min(1).default(1),
  capabilities: DeviceCapabilitiesSchema,
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  last_seen: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required').max(200),
  type: DeviceTypeSchema,
  brand: DeviceBrandSchema,
  model: z.string().max(200).optional(),
  site_id: z.string().uuid('Select a valid site'),
  ip_address: z.string().min(1, 'IP address is required'),
  port: z.number().int().min(1).max(65535).default(554),
  http_port: z.number().int().min(1).max(65535).optional(),
  rtsp_port: z.number().int().min(1).max(65535).optional(),
  channels: z.number().int().min(1).default(1),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// ── Event Schemas ──────────────────────────────────────────

export const DeviceEventSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  site_id: z.string().uuid(),
  device_id: z.string().uuid(),
  channel: z.number().int().optional(),
  event_type: z.string(),
  severity: EventSeveritySchema,
  status: EventStatusSchema,
  title: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  snapshot_url: z.string().url().optional(),
  clip_url: z.string().url().optional(),
  assigned_to: z.string().uuid().optional(),
  resolved_by: z.string().uuid().optional(),
  resolved_at: z.string().datetime().optional(),
  ai_summary: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ── Incident Schemas ───────────────────────────────────────

export const IncidentCommentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  user_name: z.string(),
  content: z.string(),
  created_at: z.string().datetime(),
});

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  site_id: z.string().uuid().optional(),
  title: z.string(),
  description: z.string(),
  status: IncidentStatusSchema,
  priority: IncidentPrioritySchema,
  assigned_to: z.string().uuid().optional(),
  created_by: z.string().uuid(),
  event_ids: z.array(z.string().uuid()).default([]),
  evidence_urls: z.array(z.string()).default([]),
  comments: z.array(IncidentCommentSchema).default([]),
  ai_summary: z.string().optional(),
  closed_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().min(1, 'Description is required'),
  priority: IncidentPrioritySchema,
  site_id: z.string().uuid().optional(),
  event_ids: z.array(z.string().uuid()).optional(),
});

// ── Site Schemas ───────────────────────────────────────────

export const SiteSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.string(),
  status: HealthStatusSchema,
  created_at: z.string().datetime(),
});

export const CreateSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required').max(200),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().default('UTC'),
});

// ── Section Schemas (Domotics / Access Control) ────────────

export const SectionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
  site_id: z.string().uuid().optional(),
  order_index: z.number().int().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
});

export const CreateSectionSchema = z.object({
  name: z.string().min(1, 'Section name is required').max(200),
  type: z.string().optional(),
  description: z.string().optional(),
  site_id: z.string().uuid().optional(),
});

// ── Domotic Device Schemas ─────────────────────────────────

export const DomoticDeviceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  section_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  state: z.string().default('off'),
  last_action: z.string().optional(),
  last_sync: z.string().datetime().optional(),
  is_online: z.boolean().default(false),
  created_at: z.string().datetime(),
});

export const CreateDomoticDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required').max(200),
  type: z.string().min(1, 'Type is required'),
  section_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
});

// ── Access Control Schemas ─────────────────────────────────

export const AccessPersonSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  full_name: z.string(),
  type: z.string(),
  section_id: z.string().uuid().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  unit: z.string().optional(),
  document_id: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
});

export const CreateAccessPersonSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(200),
  type: z.string().min(1, 'Type is required'),
  section_id: z.string().uuid().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  unit: z.string().optional(),
  document_id: z.string().optional(),
  notes: z.string().optional(),
});

export const AccessVehicleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  plate: z.string(),
  person_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  type: z.string().optional(),
  created_at: z.string().datetime(),
});

export const CreateAccessVehicleSchema = z.object({
  plate: z.string().min(1, 'Plate is required').max(20),
  person_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  type: z.string().optional(),
});

export const AccessLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  person_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  section_id: z.string().uuid().optional(),
  direction: z.string(),
  method: z.string(),
  operator_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  created_at: z.string().datetime(),
});

export const CreateAccessLogSchema = z.object({
  person_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().optional(),
  section_id: z.string().uuid().optional(),
  direction: z.enum(['entry', 'exit']),
  method: z.string().min(1, 'Method is required'),
  notes: z.string().optional(),
});

// ── Reboot Schemas ─────────────────────────────────────────

export const RebootTaskSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  device_id: z.string().uuid().optional(),
  section_id: z.string().uuid().optional(),
  reason: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  result: z.string().optional(),
  recovery_time_seconds: z.number().optional(),
  initiated_by: z.string().uuid(),
  completed_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export const CreateRebootTaskSchema = z.object({
  device_id: z.string().uuid().optional(),
  section_id: z.string().uuid().optional(),
  reason: z.string().min(1, 'Reason is required'),
});

// ── Intercom Schemas ───────────────────────────────────────

export const IntercomDeviceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  section_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  ip_address: z.string().optional(),
  sip_uri: z.string().optional(),
  is_online: z.boolean().default(false),
  created_at: z.string().datetime(),
});

export const CreateIntercomDeviceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  section_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  ip_address: z.string().optional(),
  sip_uri: z.string().optional(),
});

// ── Database Records Schemas ───────────────────────────────

export const DatabaseRecordSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  title: z.string(),
  category: z.string(),
  section_id: z.string().uuid().optional(),
  content: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateDatabaseRecordSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  category: z.string().min(1, 'Category is required'),
  section_id: z.string().uuid().optional(),
  content: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

// ── Alert Schemas ──────────────────────────────────────────

export const AlertSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  rule_id: z.string().uuid().optional(),
  title: z.string(),
  message: z.string(),
  severity: EventSeveritySchema,
  status: z.enum(['active', 'acknowledged', 'resolved', 'silenced']),
  source_type: z.string().optional(),
  source_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
  acknowledged_by: z.string().uuid().optional(),
  acknowledged_at: z.string().datetime().optional(),
  resolved_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

// ── Inferred Types ─────────────────────────────────────────

export type DeviceFormData = z.infer<typeof CreateDeviceSchema>;
export type IncidentFormData = z.infer<typeof CreateIncidentSchema>;
export type SiteFormData = z.infer<typeof CreateSiteSchema>;
export type SectionFormData = z.infer<typeof CreateSectionSchema>;
export type DomoticDeviceFormData = z.infer<typeof CreateDomoticDeviceSchema>;
export type AccessPersonFormData = z.infer<typeof CreateAccessPersonSchema>;
export type AccessVehicleFormData = z.infer<typeof CreateAccessVehicleSchema>;
export type AccessLogFormData = z.infer<typeof CreateAccessLogSchema>;
export type RebootTaskFormData = z.infer<typeof CreateRebootTaskSchema>;
export type IntercomDeviceFormData = z.infer<typeof CreateIntercomDeviceSchema>;
export type DatabaseRecordFormData = z.infer<typeof CreateDatabaseRecordSchema>;
