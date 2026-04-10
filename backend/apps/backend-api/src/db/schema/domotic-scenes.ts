import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sites } from './devices.js';

export const domoticScenes = pgTable('domotic_scenes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  icon: text('icon'),
  description: text('description'),
  actions: jsonb('actions').notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_domotic_scenes_tenant').on(table.tenantId),
  index('idx_domotic_scenes_tenant_site').on(table.tenantId, table.siteId),
]);

export const domoticSceneExecutions = pgTable('domotic_scene_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sceneId: uuid('scene_id').notNull().references(() => domoticScenes.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  executedBy: uuid('executed_by').notNull(),
  result: jsonb('result').notNull().default({}),
  status: text('status').notNull().default('completed'),
  executionTimeMs: integer('execution_time_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_domotic_scene_executions_scene').on(table.sceneId),
  index('idx_domotic_scene_executions_tenant_created').on(table.tenantId, table.createdAt),
]);
