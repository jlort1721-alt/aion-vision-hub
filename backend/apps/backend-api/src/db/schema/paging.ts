import { pgTable, uuid, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const pagingBroadcasts = pgTable('paging_broadcasts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  audioPath: text('audio_path'),
  targetSites: jsonb('target_sites').notNull().default([]),
  targetZones: jsonb('target_zones').notNull().default([]),
  priority: text('priority').notNull().default('normal'),
  status: text('status').notNull().default('pending'),
  initiatedBy: uuid('initiated_by').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_paging_broadcasts_tenant_created').on(table.tenantId, table.createdAt),
  index('idx_paging_broadcasts_tenant_status').on(table.tenantId, table.status),
]);

export const pagingTemplates = pgTable('paging_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  message: text('message').notNull(),
  priority: text('priority').notNull().default('normal'),
  isEmergency: boolean('is_emergency').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_paging_templates_tenant').on(table.tenantId),
]);
