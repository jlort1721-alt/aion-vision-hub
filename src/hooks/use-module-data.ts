// ═══════════════════════════════════════════════════════════
// Module Data Hooks — migrated to Fastify backend
// All CRUD operations route through apiClient for proper
// tenant isolation, audit logging, rate limiting, and RBAC.
// ═══════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ApiResponseMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

interface ApiResponse<T = Record<string, unknown>> { data?: T[] | T; items?: T[]; meta?: ApiResponseMeta }

/** Extract array from API response (handles both { items: [] } and [] formats) */
function extractArray(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if (Array.isArray(r.items)) return r.items as Record<string, unknown>[];
    if (Array.isArray(r.data)) return r.data as Record<string, unknown>[];
  }
  return [];
}

// ── Sections ──
export function useSections() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['sections'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/database-records', { category: 'section' });
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

export function useSectionMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (input: { name: string; type?: string; description?: string; site_id?: string }) => {
      await apiClient.post('/database-records', { ...input, category: 'section' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); toast.success('Section created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; type?: string; description?: string; is_active?: boolean }) => {
      await apiClient.patch(`/database-records/${id}`, input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); toast.success('Section updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/database-records/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); toast.success('Section deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove };
}

// ── Domotic Devices ──
export function useDomoticDevices() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['domotic_devices'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/domotics/devices');
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

export function useDomoticMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (input: { name: string; type: string; section_id?: string; brand?: string; model?: string }) => {
      await apiClient.post('/domotics/devices', input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domotic_devices'] }); toast.success('Device added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; [key: string]: unknown }) => {
      await apiClient.patch(`/domotics/devices/${id}`, input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domotic_devices'] }); toast.success('Device updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/domotics/devices/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domotic_devices'] }); toast.success('Device removed'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleState = useMutation({
    mutationFn: async ({ id, currentState }: { id: string; currentState: string }) => {
      const newState = currentState === 'on' ? 'off' : 'on';
      await apiClient.patch(`/domotics/devices/${id}`, {
        state: newState,
        last_action: `Switched ${newState} by operator`,
        last_sync: new Date().toISOString(),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domotic_devices'] }); toast.success('State toggled'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove, toggleState };
}

// ── Domotic Actions ──
export function useDomoticActions(deviceId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['domotic_actions', deviceId],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '50' };
      if (deviceId) params.deviceId = deviceId;
      const response = await apiClient.get<unknown>('/domotics/actions', params);
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

// ── Access People ──
export function useAccessPeople() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['access_people'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/access-control/people');
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

export function useAccessPeopleMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (input: { full_name: string; type: string; section_id?: string; phone?: string; email?: string; unit?: string; document_id?: string; notes?: string }) => {
      await apiClient.post('/access-control/people', input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_people'] }); toast.success('Person added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; [key: string]: unknown }) => {
      await apiClient.patch(`/access-control/people/${id}`, input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_people'] }); toast.success('Person updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/access-control/people/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_people'] }); toast.success('Person removed'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove };
}

// ── Access Vehicles ──
export function useAccessVehicles() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['access_vehicles'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/access-control/vehicles');
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

export function useAccessVehicleMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (input: { plate: string; person_id?: string; brand?: string; model?: string; color?: string; type?: string }) => {
      await apiClient.post('/access-control/vehicles', input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_vehicles'] }); toast.success('Vehicle added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/access-control/vehicles/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_vehicles'] }); toast.success('Vehicle removed'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, remove };
}

// ── Access Logs ──
export function useAccessLogs() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['access_logs'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/access-control/logs', { limit: '200' });
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

export function useAccessLogMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (input: { person_id?: string; vehicle_id?: string; section_id?: string; direction: string; method: string; notes?: string }) => {
      await apiClient.post('/access-control/logs', input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_logs'] }); toast.success('Access logged'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create };
}

// ── Reboot Tasks ──
export function useRebootTasks() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['reboot_tasks'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/reboots', { limit: '100' });
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

export function useRebootMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (input: { device_id?: string; section_id?: string; reason: string }) => {
      await apiClient.post('/reboots', { ...input, status: 'pending' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reboot_tasks'] }); toast.success('Reboot initiated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, result, recovery_time_seconds }: { id: string; status: string; result?: string; recovery_time_seconds?: number }) => {
      const updates: Record<string, unknown> = { status };
      if (result) updates.result = result;
      if (recovery_time_seconds) updates.recovery_time_seconds = recovery_time_seconds;
      if (status === 'completed' || status === 'failed') updates.completed_at = new Date().toISOString();
      await apiClient.patch(`/reboots/${id}`, updates);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reboot_tasks'] }); toast.success('Reboot status updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, updateStatus };
}

// ── Intercom Devices ──
export function useIntercomDevices() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['intercom_devices'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/intercom/devices');
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

export function useIntercomMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (input: { name: string; section_id?: string; brand?: string; model?: string; ip_address?: string; sip_uri?: string }) => {
      await apiClient.post('/intercom/devices', input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['intercom_devices'] }); toast.success('Device added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create };
}

// ── Intercom Calls ──
export function useIntercomCalls() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['intercom_calls'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/intercom/calls', { limit: '100' });
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

// ── Database Records ──
export function useDatabaseRecords() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['database_records'],
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/database-records');
      return extractArray(response);
    },
    enabled: isAuthenticated,
  });
}

export function useDatabaseRecordMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (input: { title: string; category: string; section_id?: string; content?: Record<string, unknown>; tags?: string[] }) => {
      await apiClient.post('/database-records', { ...input, content: input.content || {} });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['database_records'] }); toast.success('Record created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; [key: string]: unknown }) => {
      await apiClient.patch(`/database-records/${id}`, input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['database_records'] }); toast.success('Record updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/database-records/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['database_records'] }); toast.success('Record deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove };
}
