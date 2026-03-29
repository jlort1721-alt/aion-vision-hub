/**
 * React hooks for eWeLink / Sonoff integration.
 *
 * All tokens and credentials are managed by the backend.
 * These hooks call the backend proxy — no secrets in the browser.
 *
 * Provides:
 *   - useEWeLinkAuth()           → login, logout, status
 *   - useEWeLinkDevices()        → device list with auto-sync
 *   - useEWeLinkControl()        → control mutations (on/off/toggle)
 *   - useEWeLinkHealth()         → health check query
 *   - useEWeLinkLogs()           → connector log entries
 *   - useEWeLinkSync()           → manual device sync
 *   - useEWeLinkSectionMapping() → device-to-section mapping
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ewelink } from '@/services/integrations/ewelink';
import type { EWeLinkDeviceAction } from '@/services/integrations/ewelink';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const QUERY_KEYS = {
  health: ['ewelink', 'health'],
  devices: ['ewelink', 'devices'],
  logs: ['ewelink', 'logs'],
  status: ['ewelink', 'status'],
} as const;

// ── Auth Hook ──

export function useEWeLinkAuth() {
  const qc = useQueryClient();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check authentication status via backend (tokens are server-side)
  const { data: status } = useQuery({
    queryKey: QUERY_KEYS.status,
    queryFn: () => ewelink.getStatus(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const login = useCallback(
    async (email: string, password: string, countryCode: string = '+1') => {
      setIsLoggingIn(true);
      try {
        const result = await ewelink.login(email, password, countryCode);

        if (result.success) {
          // Backend persists tokens — just invalidate caches
          qc.invalidateQueries({ queryKey: QUERY_KEYS.status });
          qc.invalidateQueries({ queryKey: QUERY_KEYS.devices });
          qc.invalidateQueries({ queryKey: QUERY_KEYS.health });
          toast.success('eWeLink: Sesión iniciada correctamente');
        } else {
          toast.error(`eWeLink: ${result.error}`);
        }

        return result;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [qc],
  );

  const autoLogin = useCallback(
    async (accountLabel?: string) => {
      setIsLoggingIn(true);
      try {
        const result = await ewelink.autoLogin(accountLabel);

        if (result.success) {
          qc.invalidateQueries({ queryKey: QUERY_KEYS.status });
          qc.invalidateQueries({ queryKey: QUERY_KEYS.devices });
          qc.invalidateQueries({ queryKey: QUERY_KEYS.health });
          toast.success('eWeLink: Conexión automática exitosa');
        } else {
          toast.error(`eWeLink: ${result.error}`);
        }

        return result;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [qc],
  );

  const switchAccount = useCallback(
    async (accountLabel: string) => {
      setIsLoggingIn(true);
      try {
        const result = await ewelink.switchAccount(accountLabel);

        if (result.success) {
          qc.invalidateQueries({ queryKey: QUERY_KEYS.status });
          qc.invalidateQueries({ queryKey: QUERY_KEYS.devices });
          qc.invalidateQueries({ queryKey: QUERY_KEYS.health });
          toast.success(`eWeLink: Cambiado a ${accountLabel}`);
        } else {
          toast.error(`eWeLink: ${result.error}`);
        }

        return result;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [qc],
  );

  const logout = useCallback(() => {
    ewelink.logout();
    qc.invalidateQueries({ queryKey: QUERY_KEYS.status });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.devices });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.health });
    toast.info('eWeLink: Sesión cerrada');
  }, [qc]);

  return {
    login,
    autoLogin,
    switchAccount,
    logout,
    isLoggingIn,
    isAuthenticated: status?.authenticated ?? ewelink.isAuthenticated(),
    isConfigured: status?.configured ?? ewelink.isConfigured(),
    region: status?.region ?? 'unknown',
    encryptionEnabled: status?.encryptionEnabled ?? false,
    activeAccount: status?.activeAccount ?? null,
    storedAccounts: status?.storedAccounts ?? [],
    hasStoredAccounts: status?.hasStoredAccounts ?? false,
  };
}

// ── Device List Hook ──

export function useEWeLinkDevices(enabled: boolean = true) {
  return useQuery({
    queryKey: QUERY_KEYS.devices,
    queryFn: () => ewelink.listDevices(),
    enabled: enabled && ewelink.isAuthenticated(),
    staleTime: 30_000, // 30s cache
    refetchInterval: 60_000, // Auto-refresh every 60s
    retry: 2,
  });
}

// ── Device Control Hook ──

export function useEWeLinkControl() {
  const qc = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async (action: EWeLinkDeviceAction) => {
      const result = await ewelink.controlDevice(action);

      if (!result.success) {
        throw new Error(result.error || 'Control command failed');
      }

      // Log action to domotic_actions table via Fastify
      await apiClient.post('/domotics/actions', {
        device_id: action.deviceId,
        action: action.action,
        result: 'success',
      });

      return result;
    },
    onSuccess: (_data, action) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.devices });
      qc.invalidateQueries({ queryKey: ['domotic_devices'] });
      qc.invalidateQueries({ queryKey: ['domotic_actions'] });
      toast.success(`Dispositivo ${action.action === 'on' ? 'activado' : action.action === 'off' ? 'desactivado' : 'cambiado'}`);
    },
    onError: (err: Error) => {
      toast.error(`Error de control: ${err.message}`);
    },
  });
}

// ── Sync Hook ──

export function useEWeLinkSync() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const syncResult = await ewelink.syncDevices();

      // Sync devices via Fastify backend
      if (syncResult.devices.length > 0) {
        await apiClient.post('/ewelink/sync', {
          devices: syncResult.devices.map((device: Record<string, unknown>) => ({
            id: device.deviceId,
            name: device.name,
            type: inferDeviceType(device.productModel),
            brand: device.brandName,
            model: device.productModel,
            status: device.online ? 'online' : 'offline',
            state: extractDeviceState(device),
            config: {
              ewelink_id: device.deviceId,
              firmware: device.firmware,
              device_type: device.deviceType,
              params: device.params,
            },
          })),
        });
      }

      return syncResult;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.devices });
      qc.invalidateQueries({ queryKey: ['domotic_devices'] });
      toast.success(`Sincronización completa: ${result.synced} dispositivos (${result.online} en línea)`);
    },
    onError: (err: Error) => {
      toast.error(`Error de sincronización: ${err.message}`);
    },
  });
}

// ── Health Check Hook ──

export function useEWeLinkHealth() {
  return useQuery({
    queryKey: QUERY_KEYS.health,
    queryFn: () => ewelink.testConnection(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // Every 5 min
  });
}

// ── Logs Hook ──

export function useEWeLinkLogs(limit: number = 50) {
  return useQuery({
    queryKey: [...QUERY_KEYS.logs, limit],
    queryFn: () => ewelink.getLogs(limit),
    refetchInterval: 10_000, // Refresh logs every 10s
  });
}

// ── Section Mapping Hook ──

export function useEWeLinkSectionMapping() {
  const { profile } = useAuth();

  const loadMappings = useCallback(async () => {
    if (!profile?.tenant_id) return;

    const { data } = await supabase
      .from('domotic_devices' as unknown as 'profiles')
      .select('id, section_id')
      .eq('tenant_id', profile.tenant_id)
      .not('section_id', 'is', null);

    if (data) {
      ewelink.loadSectionMappings(
        data.map((d: Record<string, unknown>) => ({ deviceId: d.id as string, sectionId: d.section_id as string })),
      );
    }
  }, [profile?.tenant_id]);

  const setMapping = useCallback(
    (deviceId: string, sectionId: string) => {
      ewelink.setSectionMapping(deviceId, sectionId);
    },
    [],
  );

  return { loadMappings, setMapping, getMapping: () => ewelink.getSectionMapping() };
}

// ── Helpers ──

function inferDeviceType(model: string): string {
  const m = model.toLowerCase();
  if (m.includes('th')) return 'sensor';
  if (m.includes('pow')) return 'sensor';
  if (m.includes('4ch') || m.includes('dual')) return 'relay';
  if (m.includes('mini') || m.includes('basic') || m.includes('r2') || m.includes('r3')) return 'switch';
  if (m.includes('rf')) return 'switch';
  if (m.includes('light') || m.includes('led') || m.includes('b1') || m.includes('b2')) return 'light';
  if (m.includes('lock')) return 'lock';
  if (m.includes('door') || m.includes('dw')) return 'door';
  if (m.includes('siren') || m.includes('alarm')) return 'siren';
  return 'relay';
}

function extractDeviceState(device: { params: Record<string, unknown>; switches?: Array<{ switch: 'on' | 'off' }> }): string {
  // Multi-channel: consider 'on' if any channel is on
  if (device.switches && device.switches.length > 0) {
    return device.switches.some((s) => s.switch === 'on') ? 'on' : 'off';
  }
  // Single channel
  if (typeof device.params.switch === 'string') {
    return device.params.switch as string;
  }
  return 'off';
}
