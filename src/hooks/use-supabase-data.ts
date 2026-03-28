// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Data Hooks (migrated to Fastify backend)
// These hooks route through apiClient → Fastify for proper
// tenant isolation, audit logging, rate limiting, and RBAC.
// ═══════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { operationsApi, cloudAccountsApi, analyticsApi } from '@/services/api';

// ── Devices ───────────────────────────────────────────────

export function useDevices(refetchInterval?: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/devices', { limit: '500' });
      // After apiClient unwraps envelope, response is either [...] or { items: [...], meta: {...} }
      const items: Record<string, unknown>[] = Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
      return items.map((d) => {
        const sites = (d as Record<string, unknown>).sites as Record<string, unknown> | undefined;
        const siteWanIp = (d.site_wan_ip ?? sites?.wan_ip ?? null) as string | null;
        const siteName = (d.site_name ?? sites?.name ?? null) as string | null;
        return {
          ...d,
          site_wan_ip: siteWanIp,
          site_name: siteName,
          remote_address: siteWanIp && d.port ? `${siteWanIp}:${d.port}` : null,
        };
      });
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
      const response = await apiClient.get<any>('/sites');
      return Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
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

      const response = await apiClient.get<any>('/events', params);
      // After unwrap: either [...] or { items: [...], meta: {...} }
      const items = Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
      const total = response?.meta?.total ?? items.length;
      return {
        data: items,
        count: total,
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
      const response = await apiClient.get<any>('/events', { limit: '100' });
      return Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
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
      const response = await apiClient.get<any>('/incidents', { limit: '100' });
      return Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
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
      const response = await apiClient.get<any>('/integrations');
      return Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
    },
    enabled: isAuthenticated,
  });
}

export function useMcpConnectors() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['mcp_connectors'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/mcp/connectors');
      return Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
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
      const response = await apiClient.get<any>('/audit/logs', { limit: '500' });
      return Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
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
      const response = await apiClient.get<any>('/ai/sessions', { limit: '100' });
      return Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
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
