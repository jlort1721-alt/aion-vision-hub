import { pgTable, uuid, varchar, boolean, integer, timestamp, jsonb, text, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// ── Alert Rules ─────────────────────────────────────────────
// Defines conditions that trigger alerts when events match
export const alertRules = pgTable('alert_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // Conditions: { eventType?, severity?, siteId?, deviceId?, timeRange?: { start, end }, daysOfWeek?: number[] }
  conditions: jsonb('conditions').notNull().default({}),
  // Actions: { email?: string[], whatsapp?: string[], webhook?: string, escalationPolicyId?: string }
  actions: jsonb('actions').notNull().default({}),
  severity: varchar('severity', { length: 16 }).notNull().default('medium'),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(5),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull(),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  triggerCount: integer('trigger_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_alert_rules_tenant').on(table.tenantId),
  index('idx_alert_rules_active').on(table.tenantId, table.isActive),
]);

// ── Escalation Policies ─────────────────────────────────────
// Multi-level escalation: level 1 → timeout → level 2 → timeout → level 3
export const escalationPolicies = pgTable('escalation_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // levels: [{ level: 1, notifyRoles: ['operator'], notifyUsers: [], timeoutMinutes: 15 }, ...]
  levels: jsonb('levels').notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_escalation_policies_tenant').on(table.tenantId),
]);

// ── Alert Instances ─────────────────────────────────────────
// Each time a rule triggers, an instance is created and tracked
export const alertInstances = pgTable('alert_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id').notNull().references(() => alertRules.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id'),
  status: varchar('status', { length: 32 }).notNull().default('firing'),
  severity: varchar('severity', { length: 16 }).notNull().default('medium'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message'),
  // Current escalation level (1, 2, 3...)
  currentLevel: integer('current_level').notNull().default(1),
  escalationPolicyId: uuid('escalation_policy_id').references(() => escalationPolicies.id),
  acknowledgedBy: uuid('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  // Actions taken log: [{ action: 'email', target: 'x@y.com', sentAt: '...', status: 'sent' }]
  actionsLog: jsonb('actions_log').notNull().default([]),
  metadata: jsonb('metadata').default({}),
  nextEscalationAt: timestamp('next_escalation_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_alert_instances_tenant_status').on(table.tenantId, table.status),
  index('idx_alert_instances_rule').on(table.ruleId),
  index('idx_alert_instances_created').on(table.tenantId, table.createdAt),
  index('idx_alert_instances_escalation').on(table.nextEscalationAt),
]);

// ── Notification Channels ───────────────────────────────────
// Configurable channels: email, whatsapp, webhook, push
export const notificationChannels = pgTable('notification_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // email, whatsapp, webhook, push
  // Config depends on type:
  // email: { recipients: string[] }
  // whatsapp: { phones: string[] }
  // webhook: { url: string, headers?: Record<string,string> }
  // push: { subscriptions: PushSubscription[] }
  config: jsonb('config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_notification_channels_tenant').on(table.tenantId),
]);

// ── Notification Log ────────────────────────────────────────
// Track every notification sent
export const notificationLog = pgTable('notification_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').references(() => notificationChannels.id),
  alertInstanceId: uuid('alert_instance_id').references(() => alertInstances.id),
  type: varchar('type', { length: 32 }).notNull(),
  recipient: varchar('recipient', { length: 512 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  message: text('message'),
  status: varchar('status', { length: 32 }).notNull().default('pending'), // pending, sent, failed, delivered
  error: text('error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_notification_log_tenant').on(table.tenantId, table.createdAt),
  index('idx_notification_log_alert').on(table.alertInstanceId),
]);
