// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Offline-First Data Cache
// Uses IndexedDB to cache events (48 h), devices, sites,
// and incidents (last 50). Queues mutations when offline
// and auto-syncs with retry when the connection is restored.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef } from 'react';
import { useNetworkStatus } from './use-network-status';
import { apiClient } from '@/lib/api-client';

// ── IndexedDB helpers ────────────────────────────────────

const DB_NAME = 'aion-offline-cache';
const DB_VERSION = 1;

const STORE_EVENTS = 'events';
const STORE_DEVICES = 'devices';
const STORE_SITES = 'sites';
const STORE_INCIDENTS = 'incidents';
const STORE_MUTATION_QUEUE = 'mutation_queue';
const STORE_META = 'meta';

const ALL_STORES = [
  STORE_EVENTS,
  STORE_DEVICES,
  STORE_SITES,
  STORE_INCIDENTS,
  STORE_MUTATION_QUEUE,
  STORE_META,
] as const;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ALL_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          if (name === STORE_MUTATION_QUEUE) {
            db.createObjectStore(name, { keyPath: 'queueId', autoIncrement: true });
          } else if (name === STORE_META) {
            db.createObjectStore(name, { keyPath: 'key' });
          } else {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putAll(storeName: string, items: Record<string, unknown>[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    // Clear old data before bulk insert
    store.clear();
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getAll(storeName: string): Promise<Record<string, unknown>[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key, value });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getMeta(key: string): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result?.value ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ── Mutation queue ───────────────────────────────────────

export interface QueuedMutation {
  queueId?: number;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: string;
  retries: number;
}

async function enqueueMutation(mutation: Omit<QueuedMutation, 'queueId'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTATION_QUEUE, 'readwrite');
    tx.objectStore(STORE_MUTATION_QUEUE).add(mutation);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function dequeueMutation(queueId: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTATION_QUEUE, 'readwrite');
    tx.objectStore(STORE_MUTATION_QUEUE).delete(queueId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getAllMutations(): Promise<QueuedMutation[]> {
  return getAll(STORE_MUTATION_QUEUE) as Promise<QueuedMutation[]>;
}

// ── Constants ────────────────────────────────────────────

const EVENTS_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours
const MAX_INCIDENTS = 50;
const MAX_SYNC_RETRIES = 5;
const SYNC_RETRY_DELAY_MS = 2_000;

// ── Hook ─────────────────────────────────────────────────

export interface OfflineCacheResult {
  /** Fetch from network first; fall back to cache when offline */
  getCachedDevices: () => Promise<Record<string, unknown>[]>;
  getCachedSites: () => Promise<Record<string, unknown>[]>;
  getCachedEvents: () => Promise<Record<string, unknown>[]>;
  getCachedIncidents: () => Promise<Record<string, unknown>[]>;

  /** Queue a mutation for sync when back online */
  queueMutation: (mutation: Omit<QueuedMutation, 'queueId' | 'createdAt' | 'retries'>) => Promise<void>;

  /** Number of mutations waiting to sync */
  pendingMutations: number;

  /** Force sync now */
  syncNow: () => Promise<void>;
}

export function useOfflineCache(): OfflineCacheResult {
  const { isOnline } = useNetworkStatus();
  const pendingRef = useRef(0);
  const syncingRef = useRef(false);

  // ── Refresh cache from network ─────────────────────────

  const refreshCache = useCallback(async () => {
    if (!navigator.onLine) return;

    try {
      const [devicesRes, sitesRes, eventsRes, incidentsRes] = await Promise.allSettled([
        apiClient.get<{ data: Record<string, unknown>[] }>('/devices', { limit: '500' }),
        apiClient.get<{ data: Record<string, unknown>[] }>('/sites'),
        apiClient.get<{ data: Record<string, unknown>[] }>('/events', { limit: '200' }),
        apiClient.get<{ data: Record<string, unknown>[] }>('/incidents', { limit: String(MAX_INCIDENTS) }),
      ]);

      if (devicesRes.status === 'fulfilled') {
        const items = devicesRes.value?.data ?? devicesRes.value ?? [];
        await putAll(STORE_DEVICES, Array.isArray(items) ? items : []);
      }
      if (sitesRes.status === 'fulfilled') {
        const items = sitesRes.value?.data ?? sitesRes.value ?? [];
        await putAll(STORE_SITES, Array.isArray(items) ? items : []);
      }
      if (eventsRes.status === 'fulfilled') {
        const items = eventsRes.value?.data ?? eventsRes.value ?? [];
        // Keep only events within last 48 h
        const cutoff = Date.now() - EVENTS_MAX_AGE_MS;
        const filtered = (Array.isArray(items) ? items : []).filter((e: Record<string, unknown>) => {
          const ts = new Date(e.created_at).getTime();
          return !isNaN(ts) && ts >= cutoff;
        });
        await putAll(STORE_EVENTS, filtered);
      }
      if (incidentsRes.status === 'fulfilled') {
        const items = incidentsRes.value?.data ?? incidentsRes.value ?? [];
        const trimmed = (Array.isArray(items) ? items : []).slice(0, MAX_INCIDENTS);
        await putAll(STORE_INCIDENTS, trimmed);
      }

      await setMeta('lastRefresh', new Date().toISOString());
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[OfflineCache] Failed to refresh cache:', err);
    }
  }, []);

  // ── Cache-first getters ────────────────────────────────

  const getCachedDevices = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const res = await apiClient.get<{ data: Record<string, unknown>[] }>('/devices', { limit: '500' });
        const items = res?.data ?? res ?? [];
        const arr = Array.isArray(items) ? items : [];
        await putAll(STORE_DEVICES, arr);
        return arr;
      } catch { /* fall through to cache */ }
    }
    return getAll(STORE_DEVICES);
  }, []);

  const getCachedSites = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const res = await apiClient.get<{ data: Record<string, unknown>[] }>('/sites');
        const items = res?.data ?? res ?? [];
        const arr = Array.isArray(items) ? items : [];
        await putAll(STORE_SITES, arr);
        return arr;
      } catch { /* fall through to cache */ }
    }
    return getAll(STORE_SITES);
  }, []);

  const getCachedEvents = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const res = await apiClient.get<{ data: Record<string, unknown>[] }>('/events', { limit: '200' });
        const items = res?.data ?? res ?? [];
        const cutoff = Date.now() - EVENTS_MAX_AGE_MS;
        const filtered = (Array.isArray(items) ? items : []).filter((e: Record<string, unknown>) => {
          const ts = new Date(e.created_at).getTime();
          return !isNaN(ts) && ts >= cutoff;
        });
        await putAll(STORE_EVENTS, filtered);
        return filtered;
      } catch { /* fall through to cache */ }
    }
    return getAll(STORE_EVENTS);
  }, []);

  const getCachedIncidents = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const res = await apiClient.get<{ data: Record<string, unknown>[] }>('/incidents', { limit: String(MAX_INCIDENTS) });
        const items = res?.data ?? res ?? [];
        const trimmed = (Array.isArray(items) ? items : []).slice(0, MAX_INCIDENTS);
        await putAll(STORE_INCIDENTS, trimmed);
        return trimmed;
      } catch { /* fall through to cache */ }
    }
    return getAll(STORE_INCIDENTS);
  }, []);

  // ── Mutation queueing ──────────────────────────────────

  const queueMutationFn = useCallback(
    async (mutation: Omit<QueuedMutation, 'queueId' | 'createdAt' | 'retries'>) => {
      if (navigator.onLine) {
        // Try to send immediately
        try {
          await executeMutation({ ...mutation, createdAt: new Date().toISOString(), retries: 0 });
          return;
        } catch {
          // If fails, fall through to queue
        }
      }
      await enqueueMutation({
        ...mutation,
        createdAt: new Date().toISOString(),
        retries: 0,
      });
      pendingRef.current += 1;
    },
    [executeMutation],
  );

  // ── Execute a single mutation ──────────────────────────

  const executeMutation = useCallback(async (mutation: QueuedMutation) => {
    switch (mutation.method) {
      case 'POST':
        await apiClient.post(mutation.path, mutation.body);
        break;
      case 'PUT':
        await apiClient.put(mutation.path, mutation.body);
        break;
      case 'PATCH':
        await apiClient.patch(mutation.path, mutation.body);
        break;
      case 'DELETE':
        await apiClient.delete(mutation.path);
        break;
    }
  }, []);

  // ── Sync queue ─────────────────────────────────────────

  const syncQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;

    try {
      const mutations = await getAllMutations();
      pendingRef.current = mutations.length;

      for (const m of mutations) {
        try {
          await executeMutation(m);
          if (m.queueId != null) await dequeueMutation(m.queueId);
          pendingRef.current = Math.max(0, pendingRef.current - 1);
        } catch {
          // Retry later if we haven't exceeded max retries
          if (m.retries >= MAX_SYNC_RETRIES) {
            if (import.meta.env.DEV) console.error('[OfflineCache] Dropping mutation after max retries:', m);
            if (m.queueId != null) await dequeueMutation(m.queueId);
            pendingRef.current = Math.max(0, pendingRef.current - 1);
          } else {
            // Increment retry counter (update in DB)
            if (m.queueId != null) {
              const db = await openDB();
              await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_MUTATION_QUEUE, 'readwrite');
                tx.objectStore(STORE_MUTATION_QUEUE).put({ ...m, retries: m.retries + 1 });
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => { db.close(); reject(tx.error); };
              });
            }
            // Wait before next attempt
            await new Promise((r) => setTimeout(r, SYNC_RETRY_DELAY_MS));
          }
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, [executeMutation]);

  // ── Auto-sync when coming back online ──────────────────

  useEffect(() => {
    if (isOnline) {
      syncQueue();
      refreshCache();
    }
  }, [isOnline, syncQueue, refreshCache]);

  // ── Initial cache population ───────────────────────────

  useEffect(() => {
    refreshCache();

    // Also count pending mutations on mount
    getAllMutations().then((mutations) => {
      pendingRef.current = mutations.length;
    });
  }, [refreshCache]);

  return {
    getCachedDevices,
    getCachedSites,
    getCachedEvents,
    getCachedIncidents,
    queueMutation: queueMutationFn,
    pendingMutations: pendingRef.current,
    syncNow: syncQueue,
  };
}
