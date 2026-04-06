import { apiClient } from '@/lib/api-client';

export interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  user_id: string;
  user_email?: string;
  tenant_id: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface AuditFilters {
  action?: string;
  resource_type?: string;
  user_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const auditApi = {
  list: (filters?: AuditFilters) =>
    apiClient.get<{ success: boolean; data: AuditLog[]; meta?: { total: number } }>('/audit/logs', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: AuditLog }>(`/audit/logs/${id}`),

  export: (filters?: AuditFilters) =>
    apiClient.get<Blob>('/audit/export', filters as Record<string, string | number | boolean | undefined>),

  stats: (filters?: { from?: string; to?: string }) =>
    apiClient.get<{ success: boolean; data: { total: number; by_action: Record<string, number>; by_user: Record<string, number> } }>('/audit/stats', filters as Record<string, string | number | boolean | undefined>),
};
