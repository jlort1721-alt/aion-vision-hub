// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Smart Event Panel
// Real-time event sidebar for live view with severity filter
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Activity, Eye, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LiveViewEvent, LiveViewSeverity } from '@/hooks/use-live-view-events';

// ── Types ──────────────────────────────────────────────────

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium';

interface SmartEventPanelProps {
  events: LiveViewEvent[];
  onFocusCamera: (cameraId: string) => void;
  className?: string;
}

// ── Constants ──────────────────────────────────────────────

const SEVERITY_COLORS: Record<LiveViewSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-muted-foreground',
};

const SEVERITY_TEXT_COLORS: Record<LiveViewSeverity, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-blue-500',
  info: 'text-muted-foreground',
};

const SEVERITY_ICONS: Record<LiveViewSeverity, React.ElementType> = {
  critical: AlertTriangle,
  high: Shield,
  medium: Activity,
  low: Eye,
  info: Eye,
};

const FILTER_OPTIONS: { key: SeverityFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'critical', label: 'Critico' },
  { key: 'high', label: 'Alto' },
  { key: 'medium', label: 'Medio' },
];

// ── Helpers ────────────────────────────────────────────────

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'ahora';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `hace ${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
}

function matchesFilter(severity: LiveViewSeverity, filter: SeverityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'critical') return severity === 'critical';
  if (filter === 'high') return severity === 'critical' || severity === 'high';
  if (filter === 'medium') return severity === 'critical' || severity === 'high' || severity === 'medium';
  return true;
}

// ── Component ──────────────────────────────────────────────

export default function SmartEventPanel({
  events,
  onFocusCamera,
  className,
}: SmartEventPanelProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(events.length);

  const filteredEvents = useMemo(
    () => events.filter((e) => matchesFilter(e.severity, filter)),
    [events, filter],
  );

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (events.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevCountRef.current = events.length;
  }, [events.length]);

  return (
    <div className={cn('w-72 border-l bg-card flex flex-col shrink-0', className)}>
      {/* Header */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Eventos en Vivo</h3>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
            {filteredEvents.length}
          </Badge>
        </div>

        {/* Severity filter buttons */}
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(({ key, label }) => (
            <Button
              key={key}
              variant={filter === key ? 'default' : 'ghost'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Event list */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Shield className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-xs">Sin eventos</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onFocus={onFocusCamera}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Event Card ─────────────────────────────────────────────

interface EventCardProps {
  event: LiveViewEvent;
  onFocus: (cameraId: string) => void;
}

function EventCard({ event, onFocus }: EventCardProps) {
  const Icon = SEVERITY_ICONS[event.severity] ?? Eye;

  return (
    <button
      className="w-full text-left p-2 rounded-lg hover:bg-muted/60 transition-colors group"
      onClick={() => onFocus(event.cameraId)}
    >
      <div className="flex gap-2">
        {/* Thumbnail or severity icon */}
        {event.snapshotUrl ? (
          <div className="relative w-14 h-10 rounded overflow-hidden shrink-0 bg-muted">
            <img
              src={event.snapshotUrl}
              alt={event.cameraName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <span
              className={cn(
                'absolute top-0.5 right-0.5 w-2 h-2 rounded-full',
                SEVERITY_COLORS[event.severity],
              )}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-14 h-10 rounded bg-muted shrink-0">
            <Icon className={cn('h-4 w-4', SEVERITY_TEXT_COLORS[event.severity])} />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Badge
              className={cn(
                'text-[7px] h-3.5 px-1 text-white',
                SEVERITY_COLORS[event.severity],
              )}
            >
              {event.severity}
            </Badge>
            <span className="text-[9px] text-muted-foreground ml-auto whitespace-nowrap">
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
          <p className="text-[11px] font-medium truncate mt-0.5">
            {event.eventType.replace(/_/g, ' ')}
          </p>
          <p className="text-[9px] text-muted-foreground truncate">
            {event.cameraName}
            {event.siteName ? ` — ${event.siteName}` : ''}
          </p>
        </div>
      </div>
    </button>
  );
}
