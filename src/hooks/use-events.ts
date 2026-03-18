// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Events Domain Hook
// Typed React Query hook for events management
// ═══════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys, STALE_TIMES } from '@/lib/query-config';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { DeviceEvent } from '@/types';

// ── Types ──────────────────────────────────────────────────

interface EventFilters {
  severity?: string;
  status?: string;
  site_id?: string;
  device_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}

interface EventListResponse {
  data: DeviceEvent[];
  meta?: { total: number };
}

interface EventCountResponse {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
}

// ── Hooks ──────────────────────────────────────────────────

export function useEvents(filters?: EventFilters) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.events.list(filters),
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filters?.severity) params.severity = filters.severity;
      if (filters?.status) params.status = filters.status;
      if (filters?.site_id) params.site_id = filters.site_id;
      if (filters?.device_id) params.device_id = filters.device_id;
      if (filters?.from) params.from = filters.from;
      if (filters?.to) params.to = filters.to;
      if (filters?.limit) params.limit = filters.limit;

      const response = await apiClient.get<EventListResponse>('/events', params);
      return response.data;
    },
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated,
  });
}

export function useEvent(id: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.events.detail(id!),
    queryFn: () => apiClient.get<DeviceEvent>(`/events/${id}`),
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated && !!id,
  });
}

export function useEventCounts(filters?: Omit<EventFilters, 'limit'>) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.events.count(filters),
    queryFn: () => apiClient.get<EventCountResponse>('/events/count', filters as Record<string, string>),
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated,
  });
}

export function useEventMutations() {
  const qc = useQueryClient();

  const acknowledge = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<DeviceEvent>(`/events/${id}/acknowledge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
      toast.success('Event acknowledged');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<DeviceEvent>(`/events/${id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
      toast.success('Event resolved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<DeviceEvent>(`/events/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
      toast.success('Event dismissed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      apiClient.post<DeviceEvent>(`/events/${id}/assign`, { assigned_to: assignedTo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.all });
      toast.success('Event assigned');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiSummary = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ summary: string }>(`/events/${id}/ai-summary`),
    onError: (e: Error) => toast.error(e.message),
  });

  return { acknowledge, resolve, dismiss, assign, aiSummary };
}
