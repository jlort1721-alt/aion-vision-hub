import { z } from 'zod';

// ── Device Brands & Types (mirrors domain enums) ────────────
const deviceBrands = ['hikvision', 'dahua', 'onvif', 'generic'] as const;
const deviceTypes = ['camera', 'nvr', 'dvr', 'encoder', 'decoder', 'access_control', 'intercom'] as const;
const deviceStatuses = ['online', 'offline', 'degraded', 'maintenance', 'unknown'] as const;

// ── Create Device ───────────────────────────────────────────
export const createDeviceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  brand: z.enum(deviceBrands),
  model: z.string().max(128).optional(),
  type: z.enum(deviceTypes).default('camera'),
  ip: z
    .string()
    .min(1, 'IP address is required')
    .max(45)
    .regex(
      /^(\d{1,3}\.){3}\d{1,3}$/,
      'Must be a valid IPv4 address',
    ),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  siteId: z.string().uuid('siteId must be a valid UUID'),
  username: z.string().min(1, 'Username is required').max(128),
  password: z.string().min(1, 'Password is required').max(256),
  channels: z.coerce.number().int().min(1).max(128).optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;

// ── Update Device ───────────────────────────────────────────
export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  brand: z.enum(deviceBrands).optional(),
  model: z.string().max(128).optional(),
  type: z.enum(deviceTypes).optional(),
  ip: z
    .string()
    .max(45)
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Must be a valid IPv4 address')
    .optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  siteId: z.string().uuid('siteId must be a valid UUID').optional(),
  status: z.enum(deviceStatuses).optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
  username: z.string().min(1).max(128).optional(),
  password: z.string().min(1).max(256).optional(),
});

export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

// ── Query Filters ───────────────────────────────────────────
export const deviceFiltersSchema = z.object({
  siteId: z.string().uuid().optional(),
  status: z.enum(deviceStatuses).optional(),
  brand: z.enum(deviceBrands).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(500).default(100),
});

export type DeviceFilters = z.infer<typeof deviceFiltersSchema>;

// ── Test Connection ─────────────────────────────────────────
export const testDeviceConnectionSchema = z.object({
  ip: z.string().min(1).max(45).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  username: z.string().min(1).max(128).optional(),
  password: z.string().min(1).max(256).optional(),
  brand: z.enum(deviceBrands).optional(),
});

export type TestDeviceConnectionInput = z.infer<typeof testDeviceConnectionSchema>;
