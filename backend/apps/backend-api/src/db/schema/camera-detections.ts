import { pgTable, uuid, text, real, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { sites, devices } from './devices.js';
import { profiles } from './users.js';

export const cameraDetections = pgTable('camera_detections', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  cameraId: uuid('camera_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  type: text('type').notNull().default('unknown'),
  confidence: real('confidence').notNull().default(0),
  bboxJson: jsonb('bbox_json').notNull().default({}),
  snapshotPath: text('snapshot_path'),
  videoClipPath: text('video_clip_path'),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  notes: text('notes'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_camera_detections_tenant_ts').on(table.tenantId, table.ts),
  index('idx_camera_detections_site_ts').on(table.siteId, table.ts),
  index('idx_camera_detections_camera_ts').on(table.cameraId, table.ts),
  index('idx_camera_detections_type').on(table.type),
]);
