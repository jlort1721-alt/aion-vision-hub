import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDevices(refetchInterval?: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('devices').select('*').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
    refetchInterval,
  });
}

export function useSites(refetchInterval?: number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sites').select('*').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
    refetchInterval,
  });
}

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
      let query = supabase.from('events').select('*', { count: 'exact' });

      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }
      if (filters?.severity && filters.severity !== 'all') {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.device_id && filters.device_id !== 'all') {
        query = query.eq('device_id', filters.device_id);
      }
      if (filters?.site_id && filters.site_id !== 'all') {
        query = query.eq('site_id', filters.site_id);
      }
      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
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
      const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
    refetchInterval,
  });
}

export function useIncidents() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('incidents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useIntegrations() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('integrations').select('*').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useMcpConnectors() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['mcp_connectors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mcp_connectors').select('*').order('name');
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useAuditLogs() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useAiSessions() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['ai_sessions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_sessions').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated,
  });
}
