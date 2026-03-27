import { z } from 'zod';

const evidenceTypes = ['snapshot', 'clip', 'document', 'note'] as const;

// ── List Evidence ────────────────────────────────────────────
export const listEvidenceSchema = z.object({
  incident_id: z.string().uuid('incident_id must be a valid UUID'),
});

export type ListEvidenceInput = z.infer<typeof listEvidenceSchema>;

// ── Create Evidence ──────────────────────────────────────────
export const createEvidenceSchema = z.object({
  incident_id: z.string().uuid('incident_id must be a valid UUID'),
  device_id: z.string().uuid('device_id must be a valid UUID').optional(),
  type: z.enum(evidenceTypes).default('snapshot'),
  file_url: z.string().url().max(2048).optional(),
  thumbnail_url: z.string().url().max(2048).optional(),
  file_name: z.string().max(512).optional(),
  mime_type: z.string().max(128).optional(),
  description: z.string().max(4096).optional(),
  captured_at: z.string().datetime({ offset: true }).optional(),
});

export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;

// ── Capture Snapshot ─────────────────────────────────────────
export const captureSnapshotSchema = z.object({
  incident_id: z.string().uuid('incident_id must be a valid UUID'),
  device_id: z.string().uuid('device_id must be a valid UUID'),
  description: z.string().max(4096).optional(),
});

export type CaptureSnapshotInput = z.infer<typeof captureSnapshotSchema>;

// ── Delete Evidence ──────────────────────────────────────────
export const deleteEvidenceParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type DeleteEvidenceParams = z.infer<typeof deleteEvidenceParamsSchema>;
