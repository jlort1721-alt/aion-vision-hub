import { pgTable, uuid, integer, timestamp, jsonb, text } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { devices, sites } from './devices.js';

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  channel: integer('channel'),
  eventType: text('event_type').notNull(),
  severity: text('severity').notNull().default('info'),
  status: text('status').notNull().default('new'),
  title: text('title').notNull(),
  description: text('description'),
  metadata: jsonb('metadata').notNull().default({}),
  snapshotUrl: text('snapshot_url'),
  clipUrl: text('clip_url'),
  assignedTo: uuid('assigned_to'),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  aiSummary: text('ai_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
