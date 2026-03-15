import { pgTable, uuid, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sections } from './sections.js';

export const intercomDevices = pgTable('intercom_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  brand: text('brand').notNull().default('Fanvil'),
  model: text('model').notNull().default(''),
  ipAddress: text('ip_address'),
  sipUri: text('sip_uri'),
  status: text('status').notNull().default('offline'),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const intercomCalls = pgTable('intercom_calls', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => intercomDevices.id, { onDelete: 'set null' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  direction: text('direction').notNull().default('inbound'),
  durationSeconds: integer('duration_seconds'),
  attendedBy: text('attended_by').notNull().default('operator'),
  status: text('status').notNull().default('completed'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
