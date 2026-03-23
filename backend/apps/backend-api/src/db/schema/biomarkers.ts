import { pgTable, text, timestamp, uuid, jsonb, real } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const biomarkers = pgTable('biomarkers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  
  // Custom Subject Identifier across the intelligence cluster (e.g. SUB-992A)
  subjectId: text('subject_id').notNull(),
  
  // Vector representation of the face (Store as array of floats for cosine similarity)
  // Used in Biogenetic Facial Search operations
  embedding: real('embedding').array().notNull(),

  // Confidence Score of original extraction (0.0 to 1.0)
  confidence: real('confidence').notNull().default(0.95),

  // JSONB block to store features extracted by neural net
  // { gender: "Male", age_estimate: 35, anomalies: ["scars", "glasses"] }
  phenotypicMetadata: jsonb('phenotypic_metadata').default({}),
  
  // Array of features like ['Red Jacket', 'Black Cap']
  featureTags: text('feature_tags').array(),

  // The UUID of the Camera or Node where this biomarker was recently extracted
  lastSeenLocationId: text('last_seen_location_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
});
