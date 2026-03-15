import { pgTable, uuid, varchar, text, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// ── WhatsApp Conversations ────────────────────────────────────
export const waConversations = pgTable('wa_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  waContactPhone: varchar('wa_contact_phone', { length: 32 }).notNull(),
  waContactName: varchar('wa_contact_name', { length: 255 }),
  waProfilePicUrl: varchar('wa_profile_pic_url', { length: 1024 }),
  /** ai_bot | human_agent | closed */
  status: varchar('status', { length: 32 }).notNull().default('ai_bot'),
  assignedTo: uuid('assigned_to'),
  /** Tracks the current context / section for per-section routing */
  sectionContext: varchar('section_context', { length: 128 }),
  metadata: jsonb('metadata').default({}),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── WhatsApp Messages ─────────────────────────────────────────
export const waMessages = pgTable('wa_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => waConversations.id, { onDelete: 'cascade' }),
  /** Meta-assigned message ID (wamid) */
  waMessageId: varchar('wa_message_id', { length: 255 }),
  /** inbound | outbound */
  direction: varchar('direction', { length: 16 }).notNull(),
  /** text | template | image | document | audio | video | location | interactive | reaction */
  messageType: varchar('message_type', { length: 32 }).notNull().default('text'),
  /** ai_bot | human_agent | system | customer */
  senderType: varchar('sender_type', { length: 32 }).notNull(),
  senderName: varchar('sender_name', { length: 255 }),
  body: text('body'),
  mediaUrl: varchar('media_url', { length: 1024 }),
  /** sent | delivered | read | failed */
  deliveryStatus: varchar('delivery_status', { length: 32 }).default('sent'),
  /** Stores template name, quick-reply payloads, interactive buttons, etc. */
  metadata: jsonb('metadata').default({}),
  errorCode: varchar('error_code', { length: 64 }),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── WhatsApp Templates ────────────────────────────────────────
export const waTemplates = pgTable('wa_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  /** Template name as registered in Meta Business Manager */
  name: varchar('name', { length: 255 }).notNull(),
  /** Template language code (e.g., en_US, es) */
  language: varchar('language', { length: 16 }).notNull().default('en_US'),
  /** APPROVED | PENDING | REJECTED */
  status: varchar('status', { length: 32 }).notNull().default('PENDING'),
  category: varchar('category', { length: 64 }).notNull().default('UTILITY'),
  /** Component structure as defined by Meta Cloud API */
  components: jsonb('components').default([]),
  /** Parameter names for easy mapping */
  parameterNames: jsonb('parameter_names').default([]),
  isActive: boolean('is_active').notNull().default(true),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
