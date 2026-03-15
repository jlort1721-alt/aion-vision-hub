import { pgTable, uuid, varchar, boolean, integer, timestamp, jsonb, text, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sites } from './devices.js';

// ═══════════════════════════════════════════════════════════
// AUTOMATION RULES ENGINE
// ═══════════════════════════════════════════════════════════

export const automationRules = pgTable('automation_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // trigger: { type: 'event'|'schedule'|'device_status'|'threshold', config: {...} }
  trigger: jsonb('trigger').notNull(),
  // conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }, ...]
  conditions: jsonb('conditions').notNull().default([]),
  // actions: [{ type: 'send_alert'|'create_incident'|'send_whatsapp'|'webhook'|'toggle_device'|'activate_protocol', config: {...} }]
  actions: jsonb('actions').notNull().default([]),
  priority: integer('priority').notNull().default(1),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(5),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  triggerCount: integer('trigger_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_automation_rules_tenant').on(table.tenantId),
  index('idx_automation_rules_active').on(table.tenantId, table.isActive),
]);

export const automationExecutions = pgTable('automation_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id').notNull().references(() => automationRules.id, { onDelete: 'cascade' }),
  triggerData: jsonb('trigger_data').notNull().default({}),
  // results: [{ action: 'send_alert', status: 'success'|'failed', detail: '...' }]
  results: jsonb('results').notNull().default([]),
  status: varchar('status', { length: 32 }).notNull().default('success'), // success, partial, failed
  executionTimeMs: integer('execution_time_ms'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_automation_executions_tenant').on(table.tenantId, table.createdAt),
  index('idx_automation_executions_rule').on(table.ruleId),
]);

// ═══════════════════════════════════════════════════════════
// VISITOR MANAGEMENT WITH QR
// ═══════════════════════════════════════════════════════════

export const visitors = pgTable('visitors', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  documentId: varchar('document_id', { length: 64 }),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 255 }),
  company: varchar('company', { length: 255 }),
  photoUrl: varchar('photo_url', { length: 1024 }),
  // visitReason: meeting, delivery, maintenance, personal, other
  visitReason: varchar('visit_reason', { length: 64 }).notNull().default('personal'),
  hostName: varchar('host_name', { length: 255 }),
  hostUnit: varchar('host_unit', { length: 64 }),
  hostPhone: varchar('host_phone', { length: 32 }),
  notes: text('notes'),
  isBlacklisted: boolean('is_blacklisted').notNull().default(false),
  visitCount: integer('visit_count').notNull().default(0),
  lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_visitors_tenant').on(table.tenantId),
  index('idx_visitors_document').on(table.tenantId, table.documentId),
  index('idx_visitors_site').on(table.siteId),
]);

export const visitorPasses = pgTable('visitor_passes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  visitorId: uuid('visitor_id').notNull().references(() => visitors.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  // QR code unique token for scanning
  qrToken: varchar('qr_token', { length: 128 }).notNull(),
  // pass type: single_use, daily, multi_day, permanent
  passType: varchar('pass_type', { length: 32 }).notNull().default('single_use'),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  // status: active, used, expired, revoked
  status: varchar('status', { length: 32 }).notNull().default('active'),
  checkInAt: timestamp('check_in_at', { withTimezone: true }),
  checkOutAt: timestamp('check_out_at', { withTimezone: true }),
  checkInBy: uuid('check_in_by'),
  authorizedBy: uuid('authorized_by').notNull(),
  notes: text('notes'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_visitor_passes_tenant').on(table.tenantId),
  index('idx_visitor_passes_visitor').on(table.visitorId),
  index('idx_visitor_passes_qr').on(table.qrToken),
  index('idx_visitor_passes_status').on(table.tenantId, table.status),
]);

// ═══════════════════════════════════════════════════════════
// ANALYTICS & KPI SNAPSHOTS
// ═══════════════════════════════════════════════════════════

export const kpiSnapshots = pgTable('kpi_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // period: hourly, daily, weekly, monthly
  period: varchar('period', { length: 16 }).notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  // metrics: { events_total, events_critical, incidents_open, incidents_resolved, devices_online, devices_offline, avg_response_time, sla_compliance_pct, patrol_compliance_pct, ... }
  metrics: jsonb('metrics').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_kpi_snapshots_tenant_period').on(table.tenantId, table.period, table.periodStart),
]);

// ═══════════════════════════════════════════════════════════
// PUSH NOTIFICATION SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  // Web Push subscription JSON (endpoint, keys.p256dh, keys.auth)
  subscription: jsonb('subscription').notNull(),
  userAgent: varchar('user_agent', { length: 512 }),
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_push_subscriptions_user').on(table.tenantId, table.userId),
]);
