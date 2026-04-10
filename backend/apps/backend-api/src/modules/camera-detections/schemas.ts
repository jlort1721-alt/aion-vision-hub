import { z } from 'zod';

const detectionTypes = ['person', 'vehicle', 'animal', 'unknown'] as const;

export const createDetectionSchema = z.object({
  siteId: z.string().uuid(),
  cameraId: z.string().uuid(),
  ts: z.coerce.date().optional(),
  type: z.enum(detectionTypes).default('unknown'),
  confidence: z.number().min(0).max(1).default(0),
  bboxJson: z.record(z.string(), z.unknown()).default({}),
  snapshotPath: z.string().optional(),
  videoClipPath: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CreateDetectionInput = z.infer<typeof createDetectionSchema>;

export const listDetectionsFilterSchema = z.object({
  siteId: z.string().uuid().optional(),
  cameraId: z.string().uuid().optional(),
  type: z.enum(detectionTypes).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
});
export type ListDetectionsFilter = z.infer<typeof listDetectionsFilterSchema>;

export const reviewDetectionSchema = z.object({
  notes: z.string().max(2000).optional(),
});
export type ReviewDetectionInput = z.infer<typeof reviewDetectionSchema>;
