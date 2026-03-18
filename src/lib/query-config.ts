// ═══════════════════════════════════════════════════════════
// AION VISION HUB — React Query Configuration
// Centralized QueryClient with optimized defaults
// ═══════════════════════════════════════════════════════════

import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api-client';

/**
 * Stale time configuration per data domain.
 * Data that changes frequently has shorter stale times.
 */
export const STALE_TIMES = {
  /** Real-time data: events, alerts, incidents (5s) */
  REALTIME: 5 * 1000,
  /** Dynamic data: devices, sites, health (30s) */
  DYNAMIC: 30 * 1000,
  /** Semi-static data: users, roles, integrations (2 min) */
  SEMI_STATIC: 2 * 60 * 1000,
  /** Static data: tenants, sections, config (5 min) */
  STATIC: 5 * 60 * 1000,
  /** Reference data: permissions, modules (10 min) */
  REFERENCE: 10 * 60 * 1000,
} as const;

/**
 * GC time configuration — how long to keep data in cache after it becomes inactive.
 */
export const GC_TIMES = {
  SHORT: 5 * 60 * 1000,    // 5 min — for frequently changing data
  MEDIUM: 15 * 60 * 1000,  // 15 min — for most data
  LONG: 30 * 60 * 1000,    // 30 min — for static/reference data
} as const;

/**
 * Query key factory — ensures consistent keys across the app.
 */
export const queryKeys = {
  // ── Core ──
  devices: {
    all: ['devices'] as const,
    list: (filters?: object) => ['devices', 'list', filters] as const,
    detail: (id: string) => ['devices', 'detail', id] as const,
    health: (id: string) => ['devices', 'health', id] as const,
  },
  events: {
    all: ['events'] as const,
    list: (filters?: object) => ['events', 'list', filters] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
    count: (filters?: object) => ['events', 'count', filters] as const,
  },
  incidents: {
    all: ['incidents'] as const,
    list: (filters?: object) => ['incidents', 'list', filters] as const,
    detail: (id: string) => ['incidents', 'detail', id] as const,
  },
  sites: {
    all: ['sites'] as const,
    list: () => ['sites', 'list'] as const,
    detail: (id: string) => ['sites', 'detail', id] as const,
  },
  // ── Operations ──
  alerts: {
    all: ['alerts'] as const,
    list: (filters?: object) => ['alerts', 'list', filters] as const,
    stats: () => ['alerts', 'stats'] as const,
  },
  shifts: {
    all: ['shifts'] as const,
    list: (filters?: object) => ['shifts', 'list', filters] as const,
  },
  patrols: {
    all: ['patrols'] as const,
    list: (filters?: object) => ['patrols', 'list', filters] as const,
  },
  visitors: {
    all: ['visitors'] as const,
    list: (filters?: object) => ['visitors', 'list', filters] as const,
  },
  // ── Infrastructure ──
  health: {
    system: () => ['health', 'system'] as const,
    streams: () => ['health', 'streams'] as const,
  },
  integrations: {
    all: ['integrations'] as const,
    list: () => ['integrations', 'list'] as const,
    ewelink: () => ['integrations', 'ewelink'] as const,
  },
  // ── Data modules ──
  sections: () => ['sections'] as const,
  domoticDevices: () => ['domotic_devices'] as const,
  domoticActions: (deviceId?: string) => ['domotic_actions', deviceId] as const,
  accessPeople: () => ['access_people'] as const,
  accessVehicles: () => ['access_vehicles'] as const,
  accessLogs: () => ['access_logs'] as const,
  rebootTasks: () => ['reboot_tasks'] as const,
  intercomDevices: () => ['intercom_devices'] as const,
  intercomCalls: () => ['intercom_calls'] as const,
  databaseRecords: () => ['database_records'] as const,
  // ── Admin ──
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
  },
  roles: {
    permissions: (tenantId?: string) => ['role-module-permissions', tenantId] as const,
  },
  // ── Reports & Analytics ──
  reports: {
    summary: () => ['reports', 'summary'] as const,
    list: () => ['reports', 'list'] as const,
  },
  analytics: {
    riskScore: () => ['analytics', 'risk-score'] as const,
    dashboard: () => ['analytics', 'dashboard'] as const,
  },
  audit: {
    list: (filters?: object) => ['audit', 'list', filters] as const,
  },
} as const;

/**
 * Determines if a failed query should be retried.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;

  if (error instanceof ApiClientError) {
    // Don't retry client errors (auth, validation, not found)
    if (error.status >= 400 && error.status < 500) return false;
    // Retry server errors
    return true;
  }

  // Retry network errors
  return true;
}

/**
 * Creates the optimized QueryClient for the application.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIMES.DYNAMIC,
        gcTime: GC_TIMES.MEDIUM,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
