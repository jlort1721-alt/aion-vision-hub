import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { devices } from './devices.js';
import { sections } from './sections.js';

export const rebootTasks = pgTable('reboot_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  reason: text('reason').notNull().default(''),
  status: text('status').notNull().default('pending'),
  result: text('result'),
  recoveryTimeSeconds: integer('recovery_time_seconds'),
  initiatedBy: uuid('initiated_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
