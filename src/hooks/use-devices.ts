// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Devices Domain Hook
// Typed React Query hook replacing direct Supabase calls
// ═══════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys, STALE_TIMES } from '@/lib/query-config';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Device } from '@/types';
import type { DeviceFormData } from '@/types/schemas';

// ── Types ──────────────────────────────────────────────────

interface DeviceFilters {
  site_id?: string;
  status?: string;
  brand?: string;
  type?: string;
  search?: string;
}

interface DeviceListResponse {
  data: Device[];
  meta?: { total: number };
}

interface TestConnectionParams {
  ip_address: string;
  brand: string;
  device_id?: string;
}

interface TestConnectionResult {
  success: boolean;
  message: string;
  latency_ms: number;
}

// ── Hooks ──────────────────────────────────────────────────

export function useDevices(filters?: DeviceFilters) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.devices.list(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.site_id) params.site_id = filters.site_id;
      if (filters?.status) params.status = filters.status;
      if (filters?.brand) params.brand = filters.brand;
      if (filters?.type) params.type = filters.type;
      if (filters?.search) params.search = filters.search;

      const response = await apiClient.get<DeviceListResponse>('/devices', params);
      return response.data;
    },
    staleTime: STALE_TIMES.DYNAMIC,
    enabled: isAuthenticated,
  });
}

export function useDevice(id: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.devices.detail(id!),
    queryFn: () => apiClient.get<Device>(`/devices/${id}`),
    staleTime: STALE_TIMES.DYNAMIC,
    enabled: isAuthenticated && !!id,
  });
}

export function useDeviceMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (data: DeviceFormData) =>
      apiClient.post<Device>('/devices', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.devices.all });
      toast.success('Device created successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: DeviceFormData & { id: string }) =>
      apiClient.put<Device>(`/devices/${id}`, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.devices.all });
      qc.invalidateQueries({ queryKey: queryKeys.devices.detail(variables.id) });
      toast.success('Device updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/devices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.devices.all });
      toast.success('Device removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testConnection = useMutation({
    mutationFn: (params: TestConnectionParams) =>
      apiClient.post<TestConnectionResult>('/devices/test-connection', params),
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove, testConnection };
}
