import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sections } from './sections.js';

export const domoticDevices = pgTable('domotic_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  type: text('type').notNull().default('relay'),
  brand: text('brand').notNull().default('Sonoff'),
  model: text('model').notNull().default(''),
  status: text('status').notNull().default('offline'),
  state: text('state').notNull().default('off'),
  lastAction: text('last_action'),
  lastSync: timestamp('last_sync', { withTimezone: true }),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const domoticActions = pgTable('domotic_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').notNull().references(() => domoticDevices.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  result: text('result'),
  userId: uuid('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
