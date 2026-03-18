// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Incidents Domain Hook
// Typed React Query hook for incident lifecycle
// ═══════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys, STALE_TIMES } from '@/lib/query-config';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Incident } from '@/types';
import type { IncidentFormData } from '@/types/schemas';

// ── Types ──────────────────────────────────────────────────

interface IncidentFilters {
  status?: string;
  priority?: string;
  site_id?: string;
  assigned_to?: string;
}

interface IncidentListResponse {
  data: Incident[];
  meta?: { total: number };
}

// ── Hooks ──────────────────────────────────────────────────

export function useIncidents(filters?: IncidentFilters) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.incidents.list(filters),
    queryFn: async () => {
      const response = await apiClient.get<IncidentListResponse>('/incidents', filters as Record<string, string>);
      return response.data;
    },
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated,
  });
}

export function useIncident(id: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.incidents.detail(id!),
    queryFn: () => apiClient.get<Incident>(`/incidents/${id}`),
    staleTime: STALE_TIMES.REALTIME,
    enabled: isAuthenticated && !!id,
  });
}

export function useIncidentMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (data: IncidentFormData) =>
      apiClient.post<Incident>('/incidents', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.incidents.all });
      toast.success('Incident created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: Partial<Incident> & { id: string }) =>
      apiClient.put<Incident>(`/incidents/${id}`, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.incidents.all });
      qc.invalidateQueries({ queryKey: queryKeys.incidents.detail(variables.id) });
      toast.success('Incident updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiClient.post(`/incidents/${id}/comments`, { content }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.incidents.detail(variables.id) });
      toast.success('Comment added');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/incidents/${id}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.incidents.all });
      toast.success('Incident closed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiSummary = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ summary: string }>(`/incidents/${id}/ai-summary`),
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, addComment, close, aiSummary };
}
