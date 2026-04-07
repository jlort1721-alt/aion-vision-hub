import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const operationalNotes = pgTable('operational_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  category: text('category').notNull().default('general'),
  priority: text('priority').notNull().default('media'),
  isPinned: boolean('is_pinned').notNull().default(false),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_operational_notes_tenant').on(table.tenantId),
  index('idx_operational_notes_pinned').on(table.tenantId, table.isPinned),
]);
