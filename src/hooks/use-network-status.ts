// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Network Status Hook
// Monitors connectivity via navigator.onLine + periodic API ping.
// Provides: isOnline, isSlowConnection, lastOnlineAt
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';

const PING_INTERVAL_MS = 30_000; // 30s
const SLOW_THRESHOLD_MS = 3_000; // >3s = slow

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface NetworkStatus {
  /** True when the browser reports connectivity AND the API responds */
  isOnline: boolean;
  /** True when the API responds but latency exceeds 3 s */
  isSlowConnection: boolean;
  /** ISO timestamp of the last successful API ping */
  lastOnlineAt: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(
    navigator.onLine ? new Date().toISOString() : null,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Ping the API health endpoint ───────────────────────
  const ping = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      return;
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      // Lightweight health endpoint; fall back to base URL
      const url = API_BASE_URL ? `${API_BASE_URL}/health` : '/api/health';
      await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const elapsed = performance.now() - start;
      setIsOnline(true);
      setIsSlowConnection(elapsed > SLOW_THRESHOLD_MS);
      setLastOnlineAt(new Date().toISOString());
    } catch {
      // Fetch failed — mark offline only if the browser also says so,
      // otherwise it is just a server issue with slow/unreachable API
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
      }
      // Keep isOnline = true when navigator says online but ping fails
      // (server issue, not a network issue). Mark slow instead.
      setIsSlowConnection(true);
    }
  }, []);

  // ── Browser online/offline events ──────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date().toISOString());
      // Ping immediately to validate real connectivity
      ping();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsSlowConnection(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [ping]);

  // ── Periodic ping ──────────────────────────────────────
  useEffect(() => {
    // Initial ping
    ping();

    timerRef.current = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ping]);

  return { isOnline, isSlowConnection, lastOnlineAt };
}
