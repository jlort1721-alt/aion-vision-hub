// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Status Badge Component
// Consistent status indicators across the platform
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusVariant = 'severity' | 'device' | 'event' | 'health' | 'incident' | 'generic';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-warning/15 text-warning border-warning/30',
  low: 'bg-primary/15 text-primary border-primary/30',
  info: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const DEVICE_COLORS: Record<string, string> = {
  online: 'bg-success/15 text-success border-success/30',
  offline: 'bg-destructive/15 text-destructive border-destructive/30',
  degraded: 'bg-warning/15 text-warning border-warning/30',
  unknown: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  maintenance: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const EVENT_COLORS: Record<string, string> = {
  new: 'bg-primary/15 text-primary border-primary/30',
  acknowledged: 'bg-warning/15 text-warning border-warning/30',
  investigating: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  resolved: 'bg-success/15 text-success border-success/30',
  dismissed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-success/15 text-success border-success/30',
  degraded: 'bg-warning/15 text-warning border-warning/30',
  down: 'bg-destructive/15 text-destructive border-destructive/30',
  unknown: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const INCIDENT_COLORS: Record<string, string> = {
  open: 'bg-destructive/15 text-destructive border-destructive/30',
  investigating: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  pending: 'bg-warning/15 text-warning border-warning/30',
  resolved: 'bg-success/15 text-success border-success/30',
  closed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const GENERIC_COLORS: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/30',
  inactive: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  error: 'bg-destructive/15 text-destructive border-destructive/30',
  pending: 'bg-warning/15 text-warning border-warning/30',
  connected: 'bg-success/15 text-success border-success/30',
  disconnected: 'bg-destructive/15 text-destructive border-destructive/30',
  on: 'bg-success/15 text-success border-success/30',
  off: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const COLOR_MAPS: Record<StatusVariant, Record<string, string>> = {
  severity: SEVERITY_COLORS,
  device: DEVICE_COLORS,
  event: EVENT_COLORS,
  health: HEALTH_COLORS,
  incident: INCIDENT_COLORS,
  generic: GENERIC_COLORS,
};

interface StatusBadgeProps {
  /** The status value */
  status: string;
  /** Which color mapping to use */
  variant?: StatusVariant;
  /** Show a pulsing dot indicator */
  pulse?: boolean;
  /** Override the display label */
  label?: string;
  /** Additional className */
  className?: string;
}

export function StatusBadge({
  status,
  variant = 'generic',
  pulse = false,
  label,
  className,
}: StatusBadgeProps) {
  const colorMap = COLOR_MAPS[variant] || GENERIC_COLORS;
  const colorClasses = colorMap[status.toLowerCase()] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  const displayLabel = label || status.replace(/_/g, ' ');

  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize font-medium text-[11px] px-2 py-0.5 border',
        colorClasses,
        className
      )}
      aria-label={`Status: ${displayLabel}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2 mr-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {displayLabel}
    </Badge>
  );
}
