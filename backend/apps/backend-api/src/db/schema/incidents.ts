import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sites } from './devices.js';

export const incidents = pgTable('incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  priority: varchar('priority', { length: 16 }).notNull().default('medium'),
  status: varchar('status', { length: 32 }).notNull().default('open'),
  siteId: uuid('site_id').references(() => sites.id),
  assignedTo: uuid('assigned_to'),
  eventIds: jsonb('event_ids').default([]),
  evidence: jsonb('evidence').default([]),
  comments: jsonb('comments').default([]),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
