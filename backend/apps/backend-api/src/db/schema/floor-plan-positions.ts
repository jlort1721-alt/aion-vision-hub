import { pgTable, uuid, numeric, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sites, devices } from './devices.js';

export const floorPlanPositions = pgTable('floor_plan_positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  x: numeric('x', { precision: 7, scale: 2 }).notNull().default('0'),
  y: numeric('y', { precision: 7, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
