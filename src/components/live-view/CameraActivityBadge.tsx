// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Camera Activity Badge
// Pulsing overlay showing recent event activity on a camera
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LiveViewEvent, LiveViewSeverity } from '@/hooks/use-live-view-events';

// ── Types ──────────────────────────────────────────────────

interface CameraActivityBadgeProps {
  events: LiveViewEvent[];
  className?: string;
}

// ── Constants ──────────────────────────────────────────────

const ACTIVITY_WINDOW_MS = 30_000;
const TICK_INTERVAL_MS = 5_000;

const SEVERITY_PRIORITY: Record<LiveViewSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

const SEVERITY_RING_COLORS: Record<string, string> = {
  critical: 'ring-red-500 shadow-red-500/40',
  high: 'ring-orange-500 shadow-orange-500/40',
  medium: 'ring-yellow-500 shadow-yellow-500/40',
};

const SEVERITY_BADGE_COLORS: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
};

// ── Helpers ────────────────────────────────────────────────

function getRecentEvents(events: readonly LiveViewEvent[], now: number): LiveViewEvent[] {
  const cutoff = now - ACTIVITY_WINDOW_MS;
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

function getHighestSeverity(events: readonly LiveViewEvent[]): LiveViewSeverity | null {
  if (events.length === 0) return null;

  let highest: LiveViewSeverity = events[0].severity;
  for (const event of events) {
    if (SEVERITY_PRIORITY[event.severity] > SEVERITY_PRIORITY[highest]) {
      highest = event.severity;
    }
  }
  return highest;
}

// ── Component ──────────────────────────────────────────────

export default function CameraActivityBadge({ events, className }: CameraActivityBadgeProps) {
  const [now, setNow] = useState(Date.now());

  // Tick every 5s to re-evaluate which events are within the 30s window
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Also refresh when events change
  useEffect(() => {
    setNow(Date.now());
  }, [events]);

  const recentEvents = useMemo(() => getRecentEvents(events, now), [events, now]);
  const highestSeverity = useMemo(() => getHighestSeverity(recentEvents), [recentEvents]);

  if (recentEvents.length === 0 || !highestSeverity) {
    return null;
  }

  const ringColor = SEVERITY_RING_COLORS[highestSeverity] ?? '';
  const badgeColor = SEVERITY_BADGE_COLORS[highestSeverity] ?? 'bg-muted text-foreground';

  return (
    <div className={cn('absolute top-1.5 left-1.5 z-10 flex items-center gap-1', className)}>
      {/* Pulsing ring */}
      <div
        className={cn(
          'relative flex items-center justify-center',
          'w-6 h-6 rounded-full ring-2 shadow-lg',
          'animate-camera-activity-pulse',
          ringColor,
        )}
      >
        <span className={cn('text-[9px] font-bold leading-none rounded-full w-5 h-5 flex items-center justify-center', badgeColor)}>
          {recentEvents.length}
        </span>
      </div>

      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes camera-activity-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        .animate-camera-activity-pulse {
          animation: camera-activity-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
