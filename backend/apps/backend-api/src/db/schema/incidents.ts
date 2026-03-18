import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants.js';
import { sites } from './devices.js';

export const incidents = pgTable('incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('medium'),
  assignedTo: uuid('assigned_to'),
  createdBy: uuid('created_by').notNull(),
  eventIds: uuid('event_ids').array().default(sql`'{}'::uuid[]`),
  evidenceUrls: text('evidence_urls').array().default(sql`'{}'::text[]`),
  comments: jsonb('comments').notNull().default([]),
  aiSummary: text('ai_summary'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
