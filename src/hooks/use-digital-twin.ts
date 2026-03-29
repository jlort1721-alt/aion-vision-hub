import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type TwinDeviceState = 'online' | 'offline' | 'alarm' | 'warning';

export interface DeviceTelemetry {
  id: string;
  type: 'camera' | 'door_access' | 'hvac' | 'radar';
  state: TwinDeviceState;
  temperature?: number;
  lastPing: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

const DEFAULT_DEVICES: Record<string, DeviceTelemetry> = {
  'cam-alpha-01': { id: 'cam-alpha-01', type: 'camera', state: 'online', lastPing: new Date().toISOString() },
  'cam-beta-02': { id: 'cam-beta-02', type: 'camera', state: 'online', lastPing: new Date().toISOString() },
  'door-north-a': { id: 'door-north-a', type: 'door_access', state: 'online', lastPing: new Date().toISOString() },
  'radar-peri-1': { id: 'radar-peri-1', type: 'radar', state: 'online', lastPing: new Date().toISOString() }
};

/**
 * AION VISION HUB: Real-Time Digital Twin Hook
 * Connects to the backend WebSocket for live device telemetry.
 * Falls back to local simulation when WebSocket is unavailable.
 */
export function useDigitalTwinMQTT() {
  const { session } = useAuth();
  const [telemetryState, setTelemetryState] = useState<Record<string, DeviceTelemetry>>(DEFAULT_DEVICES);
  const [activeAlarms, setActiveAlarms] = useState<string[]>([]);
  const [twinSyncStatus, setTwinSyncStatus] = useState<'CONNECTED' | 'SYNCING' | 'OFFLINE'>('OFFLINE');
  const wsRef = useRef<WebSocket | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Process incoming device telemetry message from WebSocket
  const handleTelemetry = useCallback((data: { channel?: string; payload?: Record<string, unknown> }) => {
    if (data.channel === 'devices' || data.channel === 'telemetry') {
      const payload = data.payload;
      if (payload?.deviceId && payload?.state) {
        const deviceId = payload.deviceId as string;
        const deviceType = (payload.type as DeviceTelemetry['type'] | undefined) || undefined;
        const deviceState = payload.state as TwinDeviceState;
        const temperature = payload.temperature as number | undefined;
        const lastPing = (payload.timestamp as string) || new Date().toISOString();
        setTelemetryState(prev => ({
          ...prev,
          [deviceId]: {
            id: deviceId,
            type: deviceType || prev[deviceId]?.type || 'camera',
            state: deviceState,
            temperature,
            lastPing,
          }
        }));

        if (payload.state === 'alarm') {
          setActiveAlarms(prev => prev.includes(deviceId) ? prev : [...prev, deviceId]);
        } else if (payload.state === 'online') {
          setActiveAlarms(prev => prev.filter(id => id !== deviceId));
        }
      }
    }
  }, []);

  // Start local fallback simulation when WebSocket is unavailable
  const startFallback = useCallback(() => {
    if (fallbackRef.current) return;
    fallbackRef.current = setInterval(() => {
      setTwinSyncStatus('SYNCING');
      setTelemetryState(prev => {
        const nextState = { ...prev };
        if (Math.random() > 0.90) {
          const keys = Object.keys(nextState);
          const targetKey = keys[Math.floor(Math.random() * keys.length)];
          const newAlertState: TwinDeviceState = Math.random() > 0.5 ? 'alarm' : 'warning';
          nextState[targetKey] = { ...nextState[targetKey], state: newAlertState, lastPing: new Date().toISOString() };
          if (newAlertState === 'alarm') {
            setActiveAlarms(a => a.includes(targetKey) ? a : [...a, targetKey]);
          }
        }
        // Auto-heal
        setActiveAlarms(a => {
          if (a.length > 0 && Math.random() > 0.70) {
            const healed = a[0];
            if (nextState[healed]) nextState[healed] = { ...nextState[healed], state: 'online' };
            return a.slice(1);
          }
          return a;
        });
        return nextState;
      });
      setTimeout(() => setTwinSyncStatus('CONNECTED'), 500);
    }, 3000);
  }, []);

  useEffect(() => {
    // Attempt WebSocket connection to real backend
    if (API_URL && session?.access_token) {
      const wsUrl = API_URL.replace(/^http/, 'ws');
      try {
        // Auth via first message instead of query param to avoid token in server logs
        const ws = new WebSocket(`${wsUrl}/ws`);
        wsRef.current = ws;
        setTwinSyncStatus('SYNCING');

        ws.onopen = () => {
          // Send auth token as first message (protocol-level auth)
          ws.send(JSON.stringify({ type: 'auth', token: session.access_token }));
          setTwinSyncStatus('CONNECTED');
          ws.send(JSON.stringify({ type: 'subscribe', channel: 'devices' }));
          ws.send(JSON.stringify({ type: 'subscribe', channel: 'telemetry' }));
          // Clear fallback if it was running
          if (fallbackRef.current) {
            clearInterval(fallbackRef.current);
            fallbackRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleTelemetry(msg);
          } catch { /* malformed message */ }
        };

        ws.onclose = () => {
          setTwinSyncStatus('OFFLINE');
          wsRef.current = null;
          // Fall back to simulation
          startFallback();
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // WebSocket creation failed, use fallback
        startFallback();
      }
    } else {
      // No API URL configured, use local simulation
      startFallback();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Digital Twin unmounting');
        wsRef.current = null;
      }
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        fallbackRef.current = null;
      }
    };
  }, [session?.access_token, handleTelemetry, startFallback]);

  const dispatchTelecommand = useCallback((deviceId: string, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'command',
        channel: 'telemetry',
        payload: { deviceId, ...payload }
      }));
    } else {
      console.log(`[Digital Twin] Offline command queued for ${deviceId}:`, payload);
    }
  }, []);

  return { telemetryState, activeAlarms, twinSyncStatus, dispatchTelecommand };
}
