import { pgTable, uuid, varchar, boolean, timestamp, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  avatarUrl: varchar('avatar_url', { length: 1024 }),
  passwordHash: text('password_hash'),
  emailVerified: boolean('email_verified').default(false),
  resetToken: text('reset_token'),
  resetTokenExpires: timestamp('reset_token_expires', { withTimezone: true }),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_profiles_email_tenant').on(table.email, table.tenantId),
]);

export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
