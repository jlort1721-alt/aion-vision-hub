import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants.js';
import { sections } from './sections.js';

export const databaseRecords = pgTable('database_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  category: text('category').notNull().default('general'),
  title: text('title').notNull(),
  content: jsonb('content').notNull().default({}),
  tags: text('tags').array().default(sql`'{}'::text[]`),
  status: text('status').notNull().default('active'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
