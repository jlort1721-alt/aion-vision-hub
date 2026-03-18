// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Alerts Domain Hook
// Typed React Query hook for alert system
// ═══════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys, STALE_TIMES } from '@/lib/query-config';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { z } from 'zod';
import type { AlertSchema } from '@/types/schemas';

// ── Types ──────────────────────────────────────────────────

type Alert = z.infer<typeof AlertSchema>;

interface AlertFilters {
  severity?: string;
  status?: string;
  source_type?: string;
  from?: string;
  to?: string;
}

interface AlertListResponse {
  data: Alert[];
  meta?: { total: number };
}

interface AlertStats {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  by_severity: Record<string, number>;
}

// ── Hooks ──────────────────────────────────────────────────

export function useAlerts(filters?: AlertFilters) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.alerts.list(filters),
    queryFn: async () => {
      const response = await apiClient.get<AlertListResponse>('/alerts', filters as Record<string, string>);
      return response.data;
    },
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated,
  });
}

export function useAlertStats() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.alerts.stats(),
    queryFn: () => apiClient.get<AlertStats>('/alerts/stats'),
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated,
  });
}

export function useAlertMutations() {
  const qc = useQueryClient();

  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/alerts/${id}/acknowledge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
      toast.success('Alert acknowledged');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/alerts/${id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
      toast.success('Alert resolved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const silence = useMutation({
    mutationFn: ({ id, duration }: { id: string; duration: number }) =>
      apiClient.post(`/alerts/${id}/silence`, { duration_minutes: duration }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
      toast.success('Alert silenced');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { acknowledge, resolve, silence };
}
