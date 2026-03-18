// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Status Badge Component
// Consistent status indicators across the platform
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusVariant = 'severity' | 'device' | 'event' | 'health' | 'incident' | 'generic';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  info: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const DEVICE_COLORS: Record<string, string> = {
  online: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  offline: 'bg-red-500/15 text-red-400 border-red-500/30',
  degraded: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  unknown: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  maintenance: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const EVENT_COLORS: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  acknowledged: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  investigating: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  dismissed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  degraded: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  down: 'bg-red-500/15 text-red-400 border-red-500/30',
  unknown: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const INCIDENT_COLORS: Record<string, string> = {
  open: 'bg-red-500/15 text-red-400 border-red-500/30',
  investigating: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  closed: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const GENERIC_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inactive: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  connected: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  disconnected: 'bg-red-500/15 text-red-400 border-red-500/30',
  on: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
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
