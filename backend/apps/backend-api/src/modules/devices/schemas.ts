import { z } from 'zod';

// ── Device Brands & Types (extended for monitoring station) ──
const deviceBrands = ['hikvision', 'dahua', 'onvif', 'generic', 'linksys', 'mikrotik', 'fanvil', 'grandstream', 'ezviz', 'sonoff', 'cisco'] as const;
const deviceTypes = [
  'camera', 'nvr', 'dvr', 'xvr', 'encoder', 'decoder',
  'access_control', 'intercom',
  'network_wan', 'network_lan', 'router', 'access_point',
  'domotic', 'cloud_account_ewelink', 'cloud_account_hik',
  'server', 'other',
] as const;
const deviceStatuses = ['online', 'offline', 'degraded', 'maintenance', 'unknown', 'active', 'pending_configuration'] as const;

// ── Create Device ───────────────────────────────────────────
export const createDeviceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  brand: z.enum(deviceBrands).optional().default('generic'),
  model: z.string().max(128).optional(),
  type: z.enum(deviceTypes).default('camera'),
  ip: z
    .string()
    .max(45)
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Must be a valid IPv4 address')
    .optional()
    .nullable(),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  siteId: z.string().uuid('siteId must be a valid UUID'),
  username: z.string().max(128).optional().nullable(),
  password: z.string().max(256).optional().nullable(),
  channels: z.coerce.number().int().min(1).max(128).optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
  serialNumber: z.string().max(256).optional().nullable(),
  deviceSlug: z.string().max(128).optional().nullable(),
  subnetMask: z.string().max(45).optional().nullable(),
  gateway: z.string().max(45).optional().nullable(),
  operator: z.string().max(128).optional().nullable(),
  appName: z.string().max(256).optional().nullable(),
  appId: z.string().max(128).optional().nullable(),
  extension: z.string().max(32).optional().nullable(),
  outboundCall: z.string().max(32).optional().nullable(),
  connectionType: z.string().max(64).optional().nullable(),
  status: z.enum(deviceStatuses).optional(),
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
    .optional()
    .nullable(),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  siteId: z.string().uuid('siteId must be a valid UUID').optional(),
  status: z.enum(deviceStatuses).optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
  username: z.string().max(128).optional().nullable(),
  password: z.string().max(256).optional().nullable(),
  serialNumber: z.string().max(256).optional().nullable(),
  deviceSlug: z.string().max(128).optional().nullable(),
  subnetMask: z.string().max(45).optional().nullable(),
  gateway: z.string().max(45).optional().nullable(),
  operator: z.string().max(128).optional().nullable(),
  appName: z.string().max(256).optional().nullable(),
  appId: z.string().max(128).optional().nullable(),
  extension: z.string().max(32).optional().nullable(),
  outboundCall: z.string().max(32).optional().nullable(),
  connectionType: z.string().max(64).optional().nullable(),
});

export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

// ── Query Filters ───────────────────────────────────────────
export const deviceFiltersSchema = z.object({
  siteId: z.string().uuid().optional(),
  status: z.enum(deviceStatuses).optional(),
  brand: z.enum(deviceBrands).optional(),
  type: z.enum(deviceTypes).optional(),
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
