/**
 * Data Import — Zod Schemas
 *
 * Validation schemas for CSV/JSON row imports of residents,
 * vehicles, visitors, and devices.
 */

import { z } from 'zod';

// ── Resident Import ──────────────────────────────────────────

export const residentImportRowSchema = z.object({
  fullName: z.string().min(1, 'fullName is required').max(255),
  type: z.enum(['resident', 'visitor', 'staff', 'provider']).default('resident'),
  documentId: z.string().max(64).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  unit: z.string().max(64).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
});
export type ResidentImportRow = z.infer<typeof residentImportRowSchema>;

export const residentImportSchema = z.object({
  records: z.array(residentImportRowSchema).min(1, 'At least one record is required').max(5000, 'Maximum 5000 records per import'),
});

// ── Vehicle Import ───────────────────────────────────────────

export const vehicleImportRowSchema = z.object({
  plate: z.string().min(1, 'plate is required').max(20),
  personDocumentId: z.string().max(64).optional().nullable(),
  personId: z.string().uuid().optional().nullable(),
  brand: z.string().max(64).optional().nullable(),
  model: z.string().max(64).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
  type: z.enum(['car', 'motorcycle', 'truck', 'bicycle']).default('car'),
  status: z.enum(['active', 'inactive']).default('active'),
});
export type VehicleImportRow = z.infer<typeof vehicleImportRowSchema>;

export const vehicleImportSchema = z.object({
  records: z.array(vehicleImportRowSchema).min(1, 'At least one record is required').max(5000, 'Maximum 5000 records per import'),
});

// ── Visitor Import ───────────────────────────────────────────

export const visitorImportRowSchema = z.object({
  fullName: z.string().min(1, 'fullName is required').max(255),
  documentId: z.string().max(64).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
  visitReason: z.enum(['meeting', 'delivery', 'maintenance', 'personal', 'other']).default('personal'),
  hostName: z.string().max(255).optional().nullable(),
  hostUnit: z.string().max(64).optional().nullable(),
  hostPhone: z.string().max(32).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type VisitorImportRow = z.infer<typeof visitorImportRowSchema>;

export const visitorImportSchema = z.object({
  records: z.array(visitorImportRowSchema).min(1, 'At least one record is required').max(5000, 'Maximum 5000 records per import'),
});

// ── Device Import ────────────────────────────────────────────

export const deviceImportRowSchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
  siteId: z.string().uuid(),
  type: z.enum(['camera', 'nvr', 'dvr', 'access_control', 'sensor', 'intercom', 'alarm', 'relay', 'other']).default('camera'),
  brand: z.string().max(64).optional().nullable(),
  model: z.string().max(64).optional().nullable(),
  ipAddress: z.string().max(45).optional().nullable(),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  httpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  rtspPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  username: z.string().max(128).optional().nullable(),
  password: z.string().max(256).optional().nullable(),
  serialNumber: z.string().max(128).optional().nullable(),
  macAddress: z.string().max(17).optional().nullable(),
  channels: z.coerce.number().int().min(1).max(128).default(1),
  notes: z.string().max(1000).optional().nullable(),
});
export type DeviceImportRow = z.infer<typeof deviceImportRowSchema>;

export const deviceImportSchema = z.object({
  records: z.array(deviceImportRowSchema).min(1, 'At least one record is required').max(2000, 'Maximum 2000 records per import'),
});

// ── Import Result ────────────────────────────────────────────

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  reason: string;
  data?: Record<string, unknown>;
}
