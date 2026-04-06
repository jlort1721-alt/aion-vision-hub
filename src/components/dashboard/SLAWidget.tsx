// ═══════════════════════════════════════════════════════════
// AION VISION HUB — SLA Dashboard Widget (Compact)
// Shows 4 key SLA metrics: response time, events attended,
// cameras online, ANS compliance
// ═══════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Timer, TrendingUp, TrendingDown, Minus, Video, CheckCircle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────

interface SLAStats {
  avgResponseMinutes?: number;
  avgResponseTrend?: 'up' | 'down' | 'stable';
  eventsAttendedToday?: number;
  eventsTotalToday?: number;
  camerasOnline?: number;
  camerasTotal?: number;
  ansCompliancePercent?: number;
}

// ── Helpers ───────────────────────────────────────────────

function statusColor(pct: number): string {
  if (pct >= 90) return 'text-success';
  if (pct >= 70) return 'text-warning';
  return 'text-destructive';
}

function bgColor(pct: number): string {
  if (pct >= 90) return 'bg-success';
  if (pct >= 70) return 'bg-warning';
  return 'bg-destructive';
}

function TrendArrow({ trend }: { trend?: string }) {
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-success" />;
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Gauge Circle ──────────────────────────────────────────

function GaugeCircle({ percent, size = 56 }: { percent: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 90 ? 'hsl(var(--success))' : percent >= 70 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90 origin-center fill-foreground text-[11px] font-semibold"
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

// ── Widget ────────────────────────────────────────────────

export default function SLAWidget() {
  const { data, isLoading } = useQuery<SLAStats>({
    queryKey: ['sla-widget-stats'],
    queryFn: async () => {
      const resp = await apiClient.get<SLAStats>('/operational-data/stats');
      return resp ?? {};
    },
    refetchInterval: 30_000,
  });

  const stats: SLAStats = data ?? {};

  const eventsPct = stats.eventsTotalToday
    ? Math.round(((stats.eventsAttendedToday ?? 0) / stats.eventsTotalToday) * 100)
    : 100;

  const camerasPct = stats.camerasTotal
    ? Math.round(((stats.camerasOnline ?? 0) / stats.camerasTotal) * 100)
    : 100;

  const ansPct = stats.ansCompliancePercent ?? 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-md bg-muted/50 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          SLA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Row 1: Response Time + Events Attended */}
        <div className="grid grid-cols-2 gap-3">
          {/* Metric 1: Average Response Time */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Timer className="h-3 w-3" />
              Tiempo promedio de respuesta
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn('text-lg font-bold', statusColor(stats.avgResponseMinutes != null && stats.avgResponseMinutes <= 10 ? 95 : stats.avgResponseMinutes != null && stats.avgResponseMinutes <= 30 ? 80 : 60))}>
                {stats.avgResponseMinutes != null ? formatMinutes(stats.avgResponseMinutes) : '--'}
              </span>
              <TrendArrow trend={stats.avgResponseTrend} />
            </div>
          </div>

          {/* Metric 2: Events Attended Today */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle className="h-3 w-3" />
              Eventos atendidos hoy
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn('text-lg font-bold', statusColor(eventsPct))}>
                {stats.eventsAttendedToday ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">/ {stats.eventsTotalToday ?? 0}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', bgColor(eventsPct))}
                style={{ width: `${Math.min(100, eventsPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Cameras Online + ANS Compliance */}
        <div className="grid grid-cols-2 gap-3">
          {/* Metric 3: Cameras Online */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Video className="h-3 w-3" />
              Camaras online
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn('text-lg font-bold', statusColor(camerasPct))}>
                {stats.camerasOnline ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">/ {stats.camerasTotal ?? 0}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', bgColor(camerasPct))}
                style={{ width: `${Math.min(100, camerasPct)}%` }}
              />
            </div>
          </div>

          {/* Metric 4: ANS Compliance */}
          <div className="rounded-lg border p-3 flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Target className="h-3 w-3" />
                Cumplimiento ANS
              </div>
              <span className={cn('text-lg font-bold', statusColor(ansPct))}>
                {Math.round(ansPct)}%
              </span>
            </div>
            <GaugeCircle percent={ansPct} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
