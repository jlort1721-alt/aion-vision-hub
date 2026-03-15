import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ── Sections ──
export function useSections() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections' as any)
        .select('*')
        .order('order_index');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isAuthenticated,
  });
}

export function useSectionMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { name: string; type?: string; description?: string; site_id?: string }) => {
      const { error } = await supabase.from('sections' as any).insert({
        ...input,
        tenant_id: profile!.tenant_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); toast.success('Section created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; type?: string; description?: string; is_active?: boolean }) => {
      const { error } = await supabase.from('sections' as any).update(input as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sections'] }); toast.success('Section updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sections' as any).delete().eq('id', id);
      if (error) throw error;
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
      const { data, error } = await supabase
        .from('domotic_devices' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isAuthenticated,
  });
}

export function useDomoticMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { name: string; type: string; section_id?: string; brand?: string; model?: string }) => {
      const { error } = await supabase.from('domotic_devices' as any).insert({
        ...input,
        tenant_id: profile!.tenant_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domotic_devices'] }); toast.success('Device added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('domotic_devices' as any).update(input as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domotic_devices'] }); toast.success('Device updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('domotic_devices' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domotic_devices'] }); toast.success('Device removed'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleState = useMutation({
    mutationFn: async ({ id, currentState }: { id: string; currentState: string }) => {
      const newState = currentState === 'on' ? 'off' : 'on';
      const { error } = await supabase.from('domotic_devices' as any).update({
        state: newState,
        last_action: `Switched ${newState} by operator`,
        last_sync: new Date().toISOString(),
      } as any).eq('id', id);
      if (error) throw error;
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
      let query = supabase.from('domotic_actions' as any).select('*').order('created_at', { ascending: false }).limit(50);
      if (deviceId) query = query.eq('device_id', deviceId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any[];
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
      const { data, error } = await supabase.from('access_people' as any).select('*').order('full_name');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isAuthenticated,
  });
}

export function useAccessPeopleMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { full_name: string; type: string; section_id?: string; phone?: string; email?: string; unit?: string; document_id?: string; notes?: string }) => {
      const { error } = await supabase.from('access_people' as any).insert({
        ...input,
        tenant_id: profile!.tenant_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_people'] }); toast.success('Person added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('access_people' as any).update(input as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_people'] }); toast.success('Person updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('access_people' as any).delete().eq('id', id);
      if (error) throw error;
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
      const { data, error } = await supabase.from('access_vehicles' as any).select('*').order('plate');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isAuthenticated,
  });
}

export function useAccessVehicleMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { plate: string; person_id?: string; brand?: string; model?: string; color?: string; type?: string }) => {
      const { error } = await supabase.from('access_vehicles' as any).insert({
        ...input,
        tenant_id: profile!.tenant_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access_vehicles'] }); toast.success('Vehicle added'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('access_vehicles' as any).delete().eq('id', id);
      if (error) throw error;
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
      const { data, error } = await supabase.from('access_logs' as any).select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isAuthenticated,
  });
}

export function useAccessLogMutations() {
  const qc = useQueryClient();
  const { profile, user } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { person_id?: string; vehicle_id?: string; section_id?: string; direction: string; method: string; notes?: string }) => {
      const { error } = await supabase.from('access_logs' as any).insert({
        ...input,
        tenant_id: profile!.tenant_id,
        operator_id: user!.id,
      } as any);
      if (error) throw error;
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
      const { data, error } = await supabase.from('reboot_tasks' as any).select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isAuthenticated,
  });
}

export function useRebootMutations() {
  const qc = useQueryClient();
  const { profile, user } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { device_id?: string; section_id?: string; reason: string }) => {
      const { error } = await supabase.from('reboot_tasks' as any).insert({
        ...input,
        tenant_id: profile!.tenant_id,
        initiated_by: user!.id,
        status: 'pending',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reboot_tasks'] }); toast.success('Reboot initiated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, result, recovery_time_seconds }: { id: string; status: string; result?: string; recovery_time_seconds?: number }) => {
      const updates: any = { status };
      if (result) updates.result = result;
      if (recovery_time_seconds) updates.recovery_time_seconds = recovery_time_seconds;
      if (status === 'completed' || status === 'failed') updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from('reboot_tasks' as any).update(updates).eq('id', id);
      if (error) throw error;
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
      const { data, error } = await supabase.from('intercom_devices' as any).select('*').order('name');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isAuthenticated,
  });
}

export function useIntercomMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { name: string; section_id?: string; brand?: string; model?: string; ip_address?: string; sip_uri?: string }) => {
      const { error } = await supabase.from('intercom_devices' as any).insert({
        ...input,
        tenant_id: profile!.tenant_id,
      } as any);
      if (error) throw error;
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
      const { data, error } = await supabase.from('intercom_calls' as any).select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
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
      const { data, error } = await supabase.from('database_records' as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isAuthenticated,
  });
}

export function useDatabaseRecordMutations() {
  const qc = useQueryClient();
  const { profile, user } = useAuth();

  const create = useMutation({
    mutationFn: async (input: { title: string; category: string; section_id?: string; content?: any; tags?: string[] }) => {
      const { error } = await supabase.from('database_records' as any).insert({
        ...input,
        content: input.content || {},
        tenant_id: profile!.tenant_id,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['database_records'] }); toast.success('Record created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('database_records' as any).update({ ...input, updated_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['database_records'] }); toast.success('Record updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('database_records' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['database_records'] }); toast.success('Record deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove };
}
