// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Live View Events Hook
// WebSocket-driven ring buffer for real-time camera events
// ═══════════════════════════════════════════════════════════

import { useEffect, useCallback, useRef, useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';

// ── Types ──────────────────────────────────────────────────

export type LiveViewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface LiveViewEvent {
  id: string;
  eventType: string;
  severity: LiveViewSeverity;
  cameraId: string;
  cameraName: string;
  siteName: string;
  snapshotUrl?: string;
  timestamp: string;
}

interface LiveViewEventsState {
  events: LiveViewEvent[];
  criticalCount: number;
  latestCritical: LiveViewEvent | null;
  eventsByCameraId: Record<string, LiveViewEvent[]>;
}

const RING_BUFFER_SIZE = 50;
const CHANNEL = 'live-view-events';

// ── Helpers ────────────────────────────────────────────────

function parseLiveViewEvent(payload: Record<string, unknown>): LiveViewEvent | null {
  const id = payload.id as string | undefined;
  const eventType = (payload.eventType as string | undefined) ?? (payload.event_type as string | undefined);
  const severity = payload.severity as LiveViewSeverity | undefined;
  const cameraId = (payload.cameraId as string | undefined) ?? (payload.camera_id as string | undefined);

  if (!id || !eventType || !severity || !cameraId) {
    return null;
  }

  return {
    id,
    eventType,
    severity,
    cameraId,
    cameraName: (payload.cameraName as string) ?? (payload.camera_name as string) ?? 'Unknown',
    siteName: (payload.siteName as string) ?? (payload.site_name as string) ?? '',
    snapshotUrl: (payload.snapshotUrl as string) ?? (payload.snapshot_url as string) ?? undefined,
    timestamp: (payload.timestamp as string) ?? new Date().toISOString(),
  };
}

function isCriticalSeverity(severity: LiveViewSeverity): boolean {
  return severity === 'critical' || severity === 'high';
}

function buildEventsByCameraId(events: readonly LiveViewEvent[]): Record<string, LiveViewEvent[]> {
  const map: Record<string, LiveViewEvent[]> = {};
  for (const event of events) {
    const existing = map[event.cameraId];
    if (existing) {
      existing.push(event);
    } else {
      map[event.cameraId] = [event];
    }
  }
  return map;
}

function deriveState(events: LiveViewEvent[]): LiveViewEventsState {
  const criticalEvents = events.filter((e) => isCriticalSeverity(e.severity));
  return {
    events,
    criticalCount: criticalEvents.length,
    latestCritical: criticalEvents[0] ?? null,
    eventsByCameraId: buildEventsByCameraId(events),
  };
}

// ── Hook ───────────────────────────────────────────────────

export function useLiveViewEvents() {
  const { subscribe } = useWebSocket();
  const bufferRef = useRef<LiveViewEvent[]>([]);
  const [state, setState] = useState<LiveViewEventsState>(deriveState([]));

  const clearEvents = useCallback(() => {
    bufferRef.current = [];
    setState(deriveState([]));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe(CHANNEL, (message) => {
      const parsed = parseLiveViewEvent(message.payload);
      if (!parsed) return;

      // Deduplicate by id
      const existing = bufferRef.current;
      if (existing.some((e) => e.id === parsed.id)) return;

      // Prepend new event; trim to ring buffer size (immutable)
      const updated = [parsed, ...existing].slice(0, RING_BUFFER_SIZE);
      bufferRef.current = updated;
      setState(deriveState(updated));
    });

    return unsubscribe;
  }, [subscribe]);

  return {
    events: state.events,
    criticalCount: state.criticalCount,
    latestCritical: state.latestCritical,
    eventsByCameraId: state.eventsByCameraId,
    clearEvents,
  };
}
