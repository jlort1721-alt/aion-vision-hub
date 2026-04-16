import { z } from "zod";

const categories = [
  "general",
  "resident",
  "vehicle",
  "company",
  "provider",
  "procedure",
  "document",
  "report",
  "contract",
  "section",
  "manual",
  "policy",
  "post",
  "note",
] as const;
const recordStatuses = ["active", "archived"] as const;

export const createRecordSchema = z.object({
  sectionId: z.string().uuid().optional(),
  category: z.enum(categories).default("general"),
  title: z.string().min(1).max(255),
  content: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string().max(64)).max(20).optional(),
});
export type CreateRecordInput = z.infer<typeof createRecordSchema>;

export const updateRecordSchema = createRecordSchema.partial().extend({
  status: z.enum(recordStatuses).optional(),
});
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;

export const recordFiltersSchema = z.object({
  sectionId: z.string().uuid().optional(),
  category: z.enum(categories).optional(),
  status: z.enum(recordStatuses).optional(),
  search: z.string().max(128).optional(),
});
export type RecordFilters = z.infer<typeof recordFiltersSchema>;
