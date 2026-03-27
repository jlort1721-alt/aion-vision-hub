import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { incidents } from './incidents.js';
import { devices } from './devices.js';

export const evidence = pgTable('evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  incidentId: uuid('incident_id').notNull().references(() => incidents.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
  type: text('type').notNull().default('snapshot'), // snapshot | clip | document | note
  fileUrl: text('file_url'),
  thumbnailUrl: text('thumbnail_url'),
  fileName: text('file_name'),
  mimeType: text('mime_type'),
  description: text('description'),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_evidence_tenant').on(table.tenantId),
  index('idx_evidence_incident').on(table.incidentId),
  index('idx_evidence_device').on(table.deviceId),
  index('idx_evidence_created').on(table.tenantId, table.createdAt),
]);
