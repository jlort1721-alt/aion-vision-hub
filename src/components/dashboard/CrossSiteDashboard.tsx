// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Cross-Site Dashboard
// Aggregated KPIs across all sites + site comparison table.
// Displayed when the user toggles "All Sites" mode.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import {
  getCrossSiteStats,
  getSiteComparison,
  type CrossSiteStats,
  type SiteComparison,
} from '@/services/cross-site-api';
import {
  MonitorSpeaker, Bell, MapPin, Activity, AlertTriangle,
  CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────

function riskBadge(score: number) {
  if (score >= 70) return <Badge variant="destructive" className="text-[10px]">{score}</Badge>;
  if (score >= 40) return <Badge className="bg-warning text-white text-[10px]">{score}</Badge>;
  return <Badge variant="outline" className="text-success border-success text-[10px]">{score}</Badge>;
}

function statusIcon(status: string) {
  switch (status) {
    case 'healthy':
    case 'online':
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'degraded':
      return <AlertCircle className="h-4 w-4 text-warning" />;
    case 'down':
    case 'offline':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

// ── Props ────────────────────────────────────────────────

interface CrossSiteDashboardProps {
  /** Called when the user clicks a site row to drill down */
  onSelectSite: (siteId: string) => void;
}

// ── Component ────────────────────────────────────────────

export default function CrossSiteDashboard({ onSelectSite }: CrossSiteDashboardProps) {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  const REFRESH_INTERVAL = 30_000;

  const {
    data: stats,
    isLoading: loadingStats,
  } = useQuery<CrossSiteStats>({
    queryKey: ['cross-site-stats'],
    queryFn: getCrossSiteStats,
    enabled: isAuthenticated,
    refetchInterval: REFRESH_INTERVAL,
  });

  const {
    data: siteRows = [],
    isLoading: loadingSites,
  } = useQuery<SiteComparison[]>({
    queryKey: ['cross-site-comparison'],
    queryFn: getSiteComparison,
    enabled: isAuthenticated,
    refetchInterval: REFRESH_INTERVAL,
  });

  const loading = loadingStats || loadingSites;

  // ── KPI cards ──────────────────────────────────────────

  const kpis = [
    {
      label: t('dashboard.total_devices') || 'Total Devices',
      value: stats?.totalDevices ?? 0,
      sub: `${stats?.devicesOnline ?? 0} ${t('dashboard.online') || 'online'}`,
      icon: <MonitorSpeaker className="h-5 w-5" />,
      color: 'text-primary',
    },
    {
      label: t('dashboard.active_alerts') || 'Events (24h)',
      value: stats?.totalEvents24h ?? 0,
      sub: `${stats?.criticalEvents24h ?? 0} ${t('dashboard.critical_high') || 'critical/high'}`,
      icon: <Bell className="h-5 w-5" />,
      color: 'text-warning',
    },
    {
      label: t('dashboard.sites') || 'Sites',
      value: stats?.totalSites ?? 0,
      sub: `${stats?.sitesHealthy ?? 0} ${t('dashboard.healthy') || 'healthy'}`,
      icon: <MapPin className="h-5 w-5" />,
      color: 'text-info',
    },
    {
      label: t('dashboard.active_incidents') || 'Active Incidents',
      value: stats?.activeIncidents ?? 0,
      sub: t('dashboard.across_all_sites') || 'across all sites',
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'text-destructive',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Aggregated KPIs ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
                  </div>
                  <div className={kpi.color}>{kpi.icon}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Site Comparison Table ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('dashboard.site_comparison') || 'Site Comparison'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : siteRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t('dashboard.no_sites') || 'No sites available'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{t('common.status') || 'Status'}</th>
                    <th className="pb-2 pr-4 font-medium">{t('common.name') || 'Name'}</th>
                    <th className="pb-2 pr-4 font-medium text-center">{t('dashboard.devices') || 'Devices'}</th>
                    <th className="pb-2 pr-4 font-medium text-center">{t('dashboard.events_24h') || 'Events 24h'}</th>
                    <th className="pb-2 pr-4 font-medium text-center">{t('dashboard.incidents') || 'Incidents'}</th>
                    <th className="pb-2 font-medium text-center">{t('dashboard.risk_score') || 'Risk Score'}</th>
                  </tr>
                </thead>
                <tbody>
                  {siteRows.map((site) => (
                    <tr
                      key={site.id}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onSelectSite(site.id)}
                    >
                      <td className="py-2.5 pr-4">{statusIcon(site.status)}</td>
                      <td className="py-2.5 pr-4 font-medium truncate max-w-[200px]">{site.name}</td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className="text-success">{site.devicesOnline}</span>
                        <span className="text-muted-foreground">/{site.devicesTotal}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">{site.events24h}</td>
                      <td className="py-2.5 pr-4 text-center">
                        {site.activeIncidents > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">{site.activeIncidents}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">{riskBadge(site.riskScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
