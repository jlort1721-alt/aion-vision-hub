// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Network Scanning API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const networkApi = {
  /** POST /network/scan/host — Scan common security ports on a single host */
  scanHost: (host: string, timeout?: number) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/network/scan/host', { host, timeout }),

  /** POST /network/scan/range — Scan an IP range (CIDR or start-end) */
  scanRange: (range: string, options?: { ports?: number[]; concurrency?: number; timeout?: number }) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/network/scan/range', { range, ...options }),

  /** POST /network/scan/ports — Scan specific ports on a host */
  scanPorts: (host: string, ports: number[], timeout?: number) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/network/scan/ports', { host, ports, timeout }),

  /** GET /network/discover/onvif — ONVIF WS-Discovery multicast */
  discoverOnvif: (timeout?: number) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/network/discover/onvif', { timeout }),

  /** POST /network/identify — Identify device brand from IP/port */
  identify: (host: string, port?: number) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/network/identify', { host, port }),

  /** GET /network/interfaces — List local network interfaces */
  getInterfaces: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/network/interfaces'),

  /** GET /network/arp — Get ARP table (IP to MAC address mappings) */
  getArpTable: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/network/arp'),

  /** POST /network/ping — TCP ping a host:port */
  ping: (host: string, port: number, timeout?: number) =>
    apiClient.post<{ success: boolean; data: { host: string; port: number; reachable: boolean; latencyMs: number | null } }>('/network/ping', { host, port, timeout }),

  /** POST /network/site/:siteId/scan — Batch scan all devices in a site */
  scanSite: (siteId: string, timeout?: number) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/network/site/${siteId}/scan`, { timeout }),
};
