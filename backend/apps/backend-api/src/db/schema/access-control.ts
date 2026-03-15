import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sections } from './sections.js';

export const accessPeople = pgTable('access_people', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  type: text('type').notNull().default('resident'),
  fullName: text('full_name').notNull(),
  documentId: text('document_id'),
  phone: text('phone'),
  email: text('email'),
  unit: text('unit'),
  notes: text('notes'),
  status: text('status').notNull().default('active'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accessVehicles = pgTable('access_vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  personId: uuid('person_id').references(() => accessPeople.id, { onDelete: 'cascade' }),
  plate: text('plate').notNull(),
  brand: text('brand'),
  model: text('model'),
  color: text('color'),
  type: text('type').notNull().default('car'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accessLogs = pgTable('access_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  personId: uuid('person_id').references(() => accessPeople.id, { onDelete: 'set null' }),
  vehicleId: uuid('vehicle_id').references(() => accessVehicles.id, { onDelete: 'set null' }),
  direction: text('direction').notNull().default('in'),
  method: text('method').notNull().default('manual'),
  notes: text('notes'),
  operatorId: uuid('operator_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
