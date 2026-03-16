import { pgTable, uuid, varchar, boolean, integer, timestamp, jsonb, text, date, index, numeric } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sites } from './devices.js';

// ═══════════════════════════════════════════════════════════
// CONTRACTS & BILLING
// ═══════════════════════════════════════════════════════════

export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  contractNumber: varchar('contract_number', { length: 64 }).notNull(),
  clientName: varchar('client_name', { length: 255 }).notNull(),
  clientDocument: varchar('client_document', { length: 64 }),
  clientEmail: varchar('client_email', { length: 255 }),
  clientPhone: varchar('client_phone', { length: 32 }),
  // type: monthly, annual, one_time, project
  type: varchar('type', { length: 32 }).notNull().default('monthly'),
  // status: draft, active, suspended, terminated, expired
  status: varchar('status', { length: 32 }).notNull().default('draft'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  monthlyAmount: numeric('monthly_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('COP'),
  // services: [{ name: 'CCTV Monitoring', qty: 10, unitPrice: 50000 }, ...]
  services: jsonb('services').notNull().default([]),
  paymentTerms: varchar('payment_terms', { length: 32 }).notNull().default('net_30'),
  autoRenew: boolean('auto_renew').notNull().default(false),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_contracts_tenant').on(table.tenantId),
  index('idx_contracts_status').on(table.tenantId, table.status),
  index('idx_contracts_site').on(table.siteId),
  index('idx_contracts_number').on(table.tenantId, table.contractNumber),
]);

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contractId: uuid('contract_id').references(() => contracts.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
  // status: draft, sent, paid, overdue, cancelled, credited
  status: varchar('status', { length: 32 }).notNull().default('draft'),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('19'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('COP'),
  // lineItems: [{ description, qty, unitPrice, total }]
  lineItems: jsonb('line_items').notNull().default([]),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }),
  paymentMethod: varchar('payment_method', { length: 32 }),
  paymentReference: varchar('payment_reference', { length: 128 }),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_invoices_tenant').on(table.tenantId),
  index('idx_invoices_contract').on(table.contractId),
  index('idx_invoices_status').on(table.tenantId, table.status),
  index('idx_invoices_number').on(table.tenantId, table.invoiceNumber),
]);

// ═══════════════════════════════════════════════════════════
// KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════

export const keyInventory = pgTable('key_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  keyCode: varchar('key_code', { length: 64 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  description: text('description'),
  // type: master, access, cabinet, vehicle, other
  keyType: varchar('key_type', { length: 32 }).notNull().default('access'),
  // status: available, assigned, lost, retired
  status: varchar('status', { length: 32 }).notNull().default('available'),
  currentHolder: varchar('current_holder', { length: 255 }),
  currentHolderId: uuid('current_holder_id'),
  location: varchar('location', { length: 255 }),
  copies: integer('copies').notNull().default(1),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_key_inventory_tenant').on(table.tenantId),
  index('idx_key_inventory_site').on(table.siteId),
  index('idx_key_inventory_code').on(table.tenantId, table.keyCode),
  index('idx_key_inventory_status').on(table.tenantId, table.status),
]);

export const keyLogs = pgTable('key_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  keyId: uuid('key_id').notNull().references(() => keyInventory.id, { onDelete: 'cascade' }),
  // action: assigned, returned, reported_lost, transferred, retired
  action: varchar('action', { length: 32 }).notNull(),
  fromHolder: varchar('from_holder', { length: 255 }),
  toHolder: varchar('to_holder', { length: 255 }),
  performedBy: uuid('performed_by').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_key_logs_tenant').on(table.tenantId, table.createdAt),
  index('idx_key_logs_key').on(table.keyId),
]);

// ═══════════════════════════════════════════════════════════
// COMPLIANCE — Ley 1581 (Colombian Data Protection)
// ═══════════════════════════════════════════════════════════

export const complianceTemplates = pgTable('compliance_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  // type: habeas_data, consent_form, privacy_policy, data_retention, incident_report, data_breach_notification
  type: varchar('type', { length: 64 }).notNull(),
  content: text('content').notNull(),
  version: integer('version').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_compliance_templates_tenant').on(table.tenantId),
  index('idx_compliance_templates_type').on(table.tenantId, table.type),
]);

export const dataRetentionPolicies = pgTable('data_retention_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  // dataType: video_footage, event_logs, access_logs, visitor_records, audit_logs, personal_data
  dataType: varchar('data_type', { length: 64 }).notNull(),
  retentionDays: integer('retention_days').notNull(),
  // action: delete, archive, anonymize
  action: varchar('action', { length: 32 }).notNull().default('delete'),
  isActive: boolean('is_active').notNull().default(true),
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
  nextExecutionAt: timestamp('next_execution_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_data_retention_tenant').on(table.tenantId),
  index('idx_data_retention_type').on(table.tenantId, table.dataType),
]);

// ═══════════════════════════════════════════════════════════
// PERSONNEL TRAINING & CERTIFICATIONS
// ═══════════════════════════════════════════════════════════

export const trainingPrograms = pgTable('training_programs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // category: safety, technology, compliance, first_aid, emergency, firearms, customer_service
  category: varchar('category', { length: 64 }).notNull(),
  durationHours: integer('duration_hours').notNull(),
  isRequired: boolean('is_required').notNull().default(false),
  // validityMonths: how long certification is valid (0 = permanent)
  validityMonths: integer('validity_months').notNull().default(12),
  passingScore: integer('passing_score').notNull().default(70),
  // content: [{ module: 'Module 1', topics: [...], duration: 2 }]
  content: jsonb('content').notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_training_programs_tenant').on(table.tenantId),
  index('idx_training_programs_category').on(table.tenantId, table.category),
]);

export const certifications = pgTable('certifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull().references(() => trainingPrograms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  userName: varchar('user_name', { length: 255 }).notNull(),
  // status: enrolled, in_progress, completed, expired, failed
  status: varchar('status', { length: 32 }).notNull().default('enrolled'),
  score: integer('score'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  certificateUrl: varchar('certificate_url', { length: 1024 }),
  notes: text('notes'),
  issuedBy: uuid('issued_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_certifications_tenant').on(table.tenantId),
  index('idx_certifications_program').on(table.programId),
  index('idx_certifications_user').on(table.tenantId, table.userId),
  index('idx_certifications_status').on(table.tenantId, table.status),
  index('idx_certifications_expiry').on(table.tenantId, table.expiresAt),
]);
