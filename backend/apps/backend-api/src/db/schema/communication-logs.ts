import { pgTable, uuid, text, varchar, boolean, integer, timestamp, jsonb, index, decimal } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// ── Communication Logs — tracks all Twilio-mediated communications ──
export const communicationLogs = pgTable('communication_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 30 }).notNull(), // whatsapp, sms, voice_call, emergency_call, whatsapp_template
  direction: varchar('direction', { length: 10 }).notNull().default('outbound'), // inbound, outbound
  recipient: varchar('recipient', { length: 30 }),
  sender: varchar('sender', { length: 30 }),
  content: text('content'),
  twilioSid: varchar('twilio_sid', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('queued'), // queued, sent, delivered, failed, initiated, ringing, in-progress, completed, no-answer, busy
  errorMessage: text('error_message'),
  costEstimate: decimal('cost_estimate', { precision: 10, scale: 4 }),
  durationSeconds: integer('duration_seconds'),
  recordingUrl: text('recording_url'),
  metadata: jsonb('metadata'),
  siteId: uuid('site_id'),
  siteName: varchar('site_name', { length: 100 }),
  operator: varchar('operator', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_comm_logs_tenant_created').on(table.tenantId, table.createdAt),
  index('idx_comm_logs_channel').on(table.tenantId, table.channel),
  index('idx_comm_logs_status').on(table.tenantId, table.status),
  index('idx_comm_logs_recipient').on(table.recipient),
  index('idx_comm_logs_twilio_sid').on(table.twilioSid),
]);

// ── Notification Rules — configurable automated notifications ──
export const twilioNotificationRules = pgTable('twilio_notification_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // camera_offline, siren_test_failed, ticket_pending_24h, service_pending_7d, new_resident, daily_report, monthly_siren_reminder
  channel: varchar('channel', { length: 20 }).notNull().default('whatsapp'), // whatsapp, sms, call, all
  recipientType: varchar('recipient_type', { length: 30 }), // admin, coordinator, technician, operator, supervisor, resident
  recipientOverride: varchar('recipient_override', { length: 30 }), // specific phone number
  messageTemplate: text('message_template').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(60),
  lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_notif_rules_tenant').on(table.tenantId),
  index('idx_notif_rules_event').on(table.tenantId, table.eventType),
]);
