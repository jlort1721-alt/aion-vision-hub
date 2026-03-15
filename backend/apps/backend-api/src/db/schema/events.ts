import { pgTable, uuid, varchar, integer, timestamp, jsonb, text } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { devices, sites } from './devices.js';

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  severity: varchar('severity', { length: 16 }).notNull().default('info'),
  status: varchar('status', { length: 32 }).notNull().default('new'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  channel: integer('channel'),
  snapshotUrl: varchar('snapshot_url', { length: 1024 }),
  assignedTo: uuid('assigned_to'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
