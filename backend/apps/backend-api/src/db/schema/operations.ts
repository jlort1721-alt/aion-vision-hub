import { pgTable, uuid, varchar, boolean, integer, timestamp, jsonb, text, time, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sites } from './devices.js';

// ═══════════════════════════════════════════════════════════
// SHIFT & GUARD MANAGEMENT
// ═══════════════════════════════════════════════════════════

export const shifts = pgTable('shifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  daysOfWeek: jsonb('days_of_week').notNull().default('[0,1,2,3,4,5,6]'),
  maxGuards: integer('max_guards').notNull().default(1),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_shifts_tenant').on(table.tenantId),
  index('idx_shifts_site').on(table.siteId),
]);

export const shiftAssignments = pgTable('shift_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  shiftId: uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('scheduled'), // scheduled, checked_in, checked_out, missed, excused
  checkInAt: timestamp('check_in_at', { withTimezone: true }),
  checkOutAt: timestamp('check_out_at', { withTimezone: true }),
  checkInLocation: jsonb('check_in_location'), // { lat, lng }
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_shift_assignments_tenant').on(table.tenantId),
  index('idx_shift_assignments_shift').on(table.shiftId),
  index('idx_shift_assignments_user_date').on(table.userId, table.date),
  index('idx_shift_assignments_status').on(table.tenantId, table.status),
]);

// ═══════════════════════════════════════════════════════════
// SLA MANAGEMENT
// ═══════════════════════════════════════════════════════════

export const slaDefinitions = pgTable('sla_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  severity: varchar('severity', { length: 16 }).notNull(), // critical, high, medium, low
  responseTimeMinutes: integer('response_time_minutes').notNull(),
  resolutionTimeMinutes: integer('resolution_time_minutes').notNull(),
  businessHoursOnly: boolean('business_hours_only').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sla_definitions_tenant').on(table.tenantId),
  index('idx_sla_definitions_severity').on(table.tenantId, table.severity),
]);

export const slaTracking = pgTable('sla_tracking', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  slaId: uuid('sla_id').notNull().references(() => slaDefinitions.id, { onDelete: 'cascade' }),
  incidentId: uuid('incident_id'),
  eventId: uuid('event_id'),
  responseDeadline: timestamp('response_deadline', { withTimezone: true }).notNull(),
  resolutionDeadline: timestamp('resolution_deadline', { withTimezone: true }).notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  responseBreached: boolean('response_breached').notNull().default(false),
  resolutionBreached: boolean('resolution_breached').notNull().default(false),
  breachNotifiedAt: timestamp('breach_notified_at', { withTimezone: true }),
  status: varchar('status', { length: 32 }).notNull().default('active'), // active, met, breached, cancelled
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sla_tracking_tenant').on(table.tenantId),
  index('idx_sla_tracking_status').on(table.tenantId, table.status),
  index('idx_sla_tracking_deadlines').on(table.responseDeadline),
]);

// ═══════════════════════════════════════════════════════════
// EMERGENCY PROTOCOLS
// ═══════════════════════════════════════════════════════════

export const emergencyProtocols = pgTable('emergency_protocols', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 64 }).notNull(), // intrusion, fire, medical, panic, natural_disaster, bomb_threat
  description: text('description'),
  // steps: [{ order: 1, action: 'Call police', responsible: 'operator', autoAction?: 'send_alert' }]
  steps: jsonb('steps').notNull().default([]),
  // autoActions: [{ type: 'email', config: {...} }, { type: 'whatsapp', config: {...} }]
  autoActions: jsonb('auto_actions').notNull().default([]),
  priority: integer('priority').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_emergency_protocols_tenant').on(table.tenantId),
  index('idx_emergency_protocols_type').on(table.tenantId, table.type),
]);

export const emergencyContacts = pgTable('emergency_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 128 }).notNull(), // police, fire_dept, ambulance, supervisor, admin, custom
  phone: varchar('phone', { length: 32 }).notNull(),
  email: varchar('email', { length: 255 }),
  priority: integer('priority').notNull().default(1),
  availableHours: jsonb('available_hours'), // { start: '08:00', end: '18:00' } or null for 24/7
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_emergency_contacts_tenant').on(table.tenantId),
]);

export const emergencyActivations = pgTable('emergency_activations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  protocolId: uuid('protocol_id').notNull().references(() => emergencyProtocols.id),
  siteId: uuid('site_id').references(() => sites.id),
  activatedBy: uuid('activated_by').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('active'), // active, resolved, cancelled, false_alarm
  // timeline: [{ time: '...', action: 'Protocol activated', user: '...' }]
  timeline: jsonb('timeline').notNull().default([]),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolution: text('resolution'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_emergency_activations_tenant').on(table.tenantId),
  index('idx_emergency_activations_status').on(table.tenantId, table.status),
]);

// ═══════════════════════════════════════════════════════════
// PATROL MANAGEMENT
// ═══════════════════════════════════════════════════════════

export const patrolRoutes = pgTable('patrol_routes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  estimatedMinutes: integer('estimated_minutes').notNull().default(30),
  frequencyMinutes: integer('frequency_minutes').notNull().default(60),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_patrol_routes_tenant').on(table.tenantId),
  index('idx_patrol_routes_site').on(table.siteId),
]);

export const patrolCheckpoints = pgTable('patrol_checkpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  routeId: uuid('route_id').notNull().references(() => patrolRoutes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  location: jsonb('location'), // { lat, lng } or { zone: 'Lobby', floor: 1 }
  order: integer('order').notNull().default(0),
  qrCode: varchar('qr_code', { length: 255 }),
  requiredPhoto: boolean('required_photo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_patrol_checkpoints_route').on(table.routeId),
]);

export const patrolLogs = pgTable('patrol_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  routeId: uuid('route_id').notNull().references(() => patrolRoutes.id),
  checkpointId: uuid('checkpoint_id').references(() => patrolCheckpoints.id),
  userId: uuid('user_id').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('completed'), // completed, missed, skipped, incident
  scannedAt: timestamp('scanned_at', { withTimezone: true }),
  notes: text('notes'),
  photoUrl: varchar('photo_url', { length: 1024 }),
  incidentId: uuid('incident_id'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_patrol_logs_tenant').on(table.tenantId, table.createdAt),
  index('idx_patrol_logs_route').on(table.routeId),
  index('idx_patrol_logs_user').on(table.userId, table.createdAt),
]);

// ═══════════════════════════════════════════════════════════
// SCHEDULED REPORTS
// ═══════════════════════════════════════════════════════════

export const scheduledReports = pgTable('scheduled_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 64 }).notNull(), // daily_summary, weekly_incidents, monthly_sla, patrol_compliance, access_log
  // schedule: { cron: '0 6 * * *', timezone: 'America/Bogota' }
  schedule: jsonb('schedule').notNull(),
  // recipients: { email: ['a@b.com'], whatsapp: ['+57...'] }
  recipients: jsonb('recipients').notNull().default({}),
  format: varchar('format', { length: 16 }).notNull().default('pdf'), // pdf, csv, json
  // filters: { siteIds?: string[], severity?: string[] }
  filters: jsonb('filters').default({}),
  isActive: boolean('is_active').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_scheduled_reports_tenant').on(table.tenantId),
  index('idx_scheduled_reports_next_run').on(table.nextRunAt),
]);
