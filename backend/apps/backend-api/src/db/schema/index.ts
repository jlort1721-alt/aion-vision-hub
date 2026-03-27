export { tenants } from './tenants.js';
export { refreshTokens } from './refresh-tokens.js';
export { profiles, userRoles } from './users.js';
export { sites, devices, deviceGroups } from './devices.js';
export { events } from './events.js';
export { incidents } from './incidents.js';
export { sections } from './sections.js';
export { domoticDevices, domoticActions } from './domotics.js';
export { accessPeople, accessVehicles, accessLogs } from './access-control.js';
export { rebootTasks } from './reboots.js';
export { intercomDevices, intercomCalls } from './intercom.js';
export { callSessions, voipConfig } from './call-sessions.js';
export { databaseRecords } from './database-records.js';
export { waConversations, waMessages, waTemplates } from './whatsapp.js';
export { alertRules, escalationPolicies, alertInstances, notificationChannels, notificationLog } from './alerts.js';
export {
  shifts, shiftAssignments,
  slaDefinitions, slaTracking,
  emergencyProtocols, emergencyContacts, emergencyActivations,
  patrolRoutes, patrolCheckpoints, patrolLogs,
  scheduledReports,
} from './operations.js';
export {
  automationRules, automationExecutions,
  visitors, visitorPasses,
  kpiSnapshots,
  pushSubscriptions,
} from './phase3.js';
export {
  contracts, invoices,
  keyInventory, keyLogs,
  complianceTemplates, dataRetentionPolicies,
  trainingPrograms, certifications,
} from './phase4.js';
export { reports } from './reports.js';
export { biomarkers } from './biomarkers.js';
export { apiKeys } from '../../modules/api-keys/schema.js';
export { evidence } from './evidence.js';

import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, varchar, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants.js';

// ── Notification Templates ───────────────────────────────────
// Unified templates for email, WhatsApp, push notifications
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 32 }).notNull(), // alert, incident, shift, visitor, access, system, automation
  channel: varchar('channel', { length: 16 }).notNull(), // email, whatsapp, push, all
  subject: varchar('subject', { length: 255 }), // for email
  bodyTemplate: text('body_template').notNull(),
  variables: jsonb('variables').notNull().default([]),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_notification_templates_tenant').on(table.tenantId),
  index('idx_notification_templates_category').on(table.tenantId, table.category),
  index('idx_notification_templates_channel').on(table.tenantId, table.channel),
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  status: text('status').notNull().default('inactive'),
  config: jsonb('config').notNull().default({}),
  lastSync: timestamp('last_sync', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mcpConnectors = pgTable('mcp_connectors', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull().default('disconnected'),
  endpoint: text('endpoint'),
  scopes: text('scopes').array().default(sql`'{}'::text[]`),
  health: text('health').notNull().default('unknown'),
  lastCheck: timestamp('last_check', { withTimezone: true }),
  errorCount: integer('error_count').notNull().default(0),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiSessions = pgTable('ai_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  provider: text('provider').notNull().default('lovable'),
  model: text('model').notNull().default('google/gemini-3-flash-preview'),
  contextType: text('context_type'),
  contextId: text('context_id'),
  messages: jsonb('messages').notNull().default([]),
  totalTokens: integer('total_tokens').notNull().default(0),
  estimatedCost: text('estimated_cost').notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(false),
  tenantOverride: jsonb('tenant_override').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roleModulePermissions = pgTable('role_module_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  module: text('module').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const liveViewLayouts = pgTable('live_view_layouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  grid: integer('grid').notNull().default(9),
  slots: jsonb('slots').notNull().default([]),
  isFavorite: boolean('is_favorite').notNull().default(false),
  isShared: boolean('is_shared').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const streams = pgTable('streams', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').notNull(),
  channel: integer('channel').notNull().default(1),
  type: text('type').notNull().default('main'),
  codec: text('codec').notNull().default('H.264'),
  resolution: text('resolution').notNull().default('1920x1080'),
  fps: integer('fps').notNull().default(25),
  bitrate: integer('bitrate'),
  urlTemplate: text('url_template').notNull().default(''),
  protocol: text('protocol').notNull().default('rtsp'),
  isActive: boolean('is_active').notNull().default(true),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
});

export const playbackRequests = pgTable('playback_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').notNull(),
  channel: integer('channel').notNull().default(1),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending'),
  outputUrl: text('output_url'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
