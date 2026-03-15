export { tenants } from './tenants.js';
export { profiles, userRoles } from './users.js';
export { sites, devices } from './devices.js';
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

import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  resource: varchar('resource', { length: 64 }).notNull(),
  resourceId: varchar('resource_id', { length: 128 }),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 64 }).notNull(),
  config: jsonb('config').default({}),
  isActive: boolean('is_active').notNull().default(true),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 64 }).notNull(),
  format: varchar('format', { length: 16 }).notNull().default('json'),
  parameters: jsonb('parameters').default({}),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  outputUrl: varchar('output_url', { length: 1024 }),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mcpConnectors = pgTable('mcp_connectors', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 64 }).notNull(),
  endpoint: varchar('endpoint', { length: 1024 }).notNull(),
  tools: jsonb('tools').default([]),
  isActive: boolean('is_active').notNull().default(true),
  lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiSessions = pgTable('ai_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  provider: varchar('provider', { length: 64 }).notNull(),
  model: varchar('model', { length: 128 }).notNull(),
  messages: jsonb('messages').default([]),
  tokensUsed: varchar('tokens_used', { length: 32 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
