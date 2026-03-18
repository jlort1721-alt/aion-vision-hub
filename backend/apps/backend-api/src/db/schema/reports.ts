import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { profiles } from './users.js';

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  description: text('description'),
  parameters: jsonb('parameters').default({}),
  format: varchar('format', { length: 20 }).notNull().default('pdf'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  resultUrl: text('result_url'),
  generatedBy: uuid('generated_by').references(() => profiles.id, { onDelete: 'set null' }),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
