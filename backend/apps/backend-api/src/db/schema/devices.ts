import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const sites = pgTable('sites', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 512 }),
  latitude: varchar('latitude', { length: 32 }),
  longitude: varchar('longitude', { length: 32 }),
  timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
  gatewayId: varchar('gateway_id', { length: 128 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 64 }).notNull(),
  model: varchar('model', { length: 128 }),
  type: varchar('type', { length: 64 }).notNull().default('camera'),
  ip: varchar('ip', { length: 45 }).notNull(),
  port: integer('port').notNull().default(80),
  rtspUrl: varchar('rtsp_url', { length: 512 }),
  status: varchar('status', { length: 32 }).notNull().default('unknown'),
  channels: integer('channels').notNull().default(1),
  firmware: varchar('firmware', { length: 128 }),
  serial: varchar('serial', { length: 128 }),
  mac: varchar('mac', { length: 17 }),
  credentialRef: varchar('credential_ref', { length: 512 }).notNull(),
  gatewayId: varchar('gateway_id', { length: 128 }),
  tags: jsonb('tags').default([]),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
