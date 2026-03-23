// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Data Hooks (migrated to Fastify backend)
// These hooks route through apiClient → Fastify for proper
// tenant isolation, audit logging, rate limiting, and RBAC.
// ═══════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { operationsApi, cloudAccountsApi, analyticsApi } from '@/services/api';

// ── Response types ────────────────────────────────────────

interface PaginatedResponse<T> {
  data: T[];
  meta?: { total?: number; page?: number; pageSize?: number };
}

// ── Devices ───────────────────────────────────────────────

export function useDevices(refetchInterval?: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/devices', { limit: '500' });
      return (response.data ?? []).map((d: any) => ({
        ...d,
        site_wan_ip: d.site_wan_ip ?? d.sites?.wan_ip ?? null,
        site_name: d.site_name ?? d.sites?.name ?? null,
        remote_address: (d.site_wan_ip || d.sites?.wan_ip) && d.port
          ? `${d.site_wan_ip || d.sites?.wan_ip}:${d.port}`
          : null,
      }));
    },
    enabled: isAuthenticated,
    refetchInterval,
  });
}

// ── Sites ─────────────────────────────────────────────────

export function useSites(refetchInterval?: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/sites');
      return response.data ?? [];
    },
    enabled: isAuthenticated,
    refetchInterval,
  });
}

// ── Events ────────────────────────────────────────────────

export interface EventFilters {
  search?: string;
  severity?: string;
  status?: string;
  device_id?: string;
  site_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  pageSize?: number;
}

export function useEvents(filters?: EventFilters) {
  const { isAuthenticated } = useAuth();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;

  return useQuery({
    queryKey: ['events', filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit: pageSize,
      };
      if (filters?.search) params.search = filters.search;
      if (filters?.severity && filters.severity !== 'all') params.severity = filters.severity;
      if (filters?.status && filters.status !== 'all') params.status = filters.status;
      if (filters?.device_id && filters.device_id !== 'all') params.deviceId = filters.device_id;
      if (filters?.site_id && filters.site_id !== 'all') params.siteId = filters.site_id;
      if (filters?.date_from) params.from = filters.date_from;
      if (filters?.date_to) params.to = filters.date_to;

      const response = await apiClient.get<PaginatedResponse<any>>('/events', params);
      return {
        data: response.data ?? [],
        count: response.meta?.total ?? (response.data?.length ?? 0),
      };
    },
    enabled: isAuthenticated,
  });
}

/** Legacy hook for components that expect a flat array */
export function useEventsLegacy(refetchInterval?: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['events-legacy'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/events', { limit: '100' });
      return response.data ?? [];
    },
    enabled: isAuthenticated,
    refetchInterval,
  });
}

// ── Incidents ─────────────────────────────────────────────

export function useIncidents() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/incidents', { limit: '100' });
      return response.data ?? [];
    },
    enabled: isAuthenticated,
  });
}

// ── Integrations (migrated to Fastify) ──

export function useIntegrations() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/integrations');
      return response.data ?? [];
    },
    enabled: isAuthenticated,
  });
}

export function useMcpConnectors() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['mcp_connectors'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/mcp/connectors');
      return response.data ?? [];
    },
    enabled: isAuthenticated,
  });
}

// ── Audit Logs ────────────────────────────────────────────

export function useAuditLogs() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/audit/logs', { limit: '500' });
      return response.data ?? [];
    },
    enabled: isAuthenticated,
  });
}

// ── AI Sessions (migrated to Fastify) ──

export function useAiSessions() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['ai_sessions'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<any>>('/ai/sessions', { limit: '100' });
      return response.data ?? [];
    },
    enabled: isAuthenticated,
  });
}

// ── Operations & Analytics (already via API service layer) ──

export function useOperationsDashboard(refetchInterval?: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['operations-dashboard'],
    queryFn: () => operationsApi.dashboard(),
    enabled: isAuthenticated,
    refetchInterval,
  });
}

export function useCloudAccountMapping() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['cloud-account-mapping'],
    queryFn: () => cloudAccountsApi.mapping(),
    enabled: isAuthenticated,
  });
}

export function useRiskScore() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['risk-score'],
    queryFn: () => analyticsApi.riskScore(),
    enabled: isAuthenticated,
  });
}
