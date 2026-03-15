import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useDevices, useSites, useEventsLegacy } from '@/hooks/use-supabase-data';
import { useRealtimeEvents } from '@/hooks/use-realtime-events';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { healthApi } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, LineChart, Line,
} from 'recharts';
import {
  MonitorSpeaker, Bell, AlertTriangle, Activity, Video, ArrowRight,
  CheckCircle2, XCircle, AlertCircle, MapPin, Clock, Shield, BellRing, BellOff
} from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'hsl(0, 84%, 60%)',
  high: 'hsl(25, 95%, 53%)',
  medium: 'hsl(48, 96%, 53%)',
  low: 'hsl(142, 71%, 45%)',
  info: 'hsl(217, 91%, 60%)',
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'healthy': case 'online': return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'degraded': return <AlertCircle className="h-4 w-4 text-warning" />;
    case 'down': case 'offline': return <XCircle className="h-4 w-4 text-destructive" />;
    default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const REFRESH_INTERVAL = 30000;
  const { data: devices = [], isLoading: loadingDevices } = useDevices(REFRESH_INTERVAL);
  const { data: sites = [], isLoading: loadingSites } = useSites(REFRESH_INTERVAL);
  const { data: events = [], isLoading: loadingEvents } = useEventsLegacy(REFRESH_INTERVAL);
  const { isAuthenticated } = useAuth();
  const { data: healthData } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => healthApi.check(),
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const healthChecks = healthData?.checks || [];
  useRealtimeEvents();
  const { permission, subscribe, unsubscribe, isSubscribed } = usePushNotifications();
  const { t } = useI18n();
  const loading = loadingDevices || loadingSites || loadingEvents;

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const offlineDevices = devices.filter(d => d.status === 'offline').length;
  const activeEvents = events.filter(e => e.status === 'new' || e.status === 'acknowledged').length;
  const criticalEvents = events.filter(e => e.severity === 'critical' || e.severity === 'high').length;

  // ── Events per hour (last 24h) ──
  const eventsPerHour = useMemo(() => {
    const now = new Date();
    const hours: { hour: string; count: number; critical: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now);
      h.setHours(h.getHours() - i, 0, 0, 0);
      const nextH = new Date(h);
      nextH.setHours(nextH.getHours() + 1);
      const hourEvents = events.filter(e => {
        const t = new Date(e.created_at);
        return t >= h && t < nextH;
      });
      hours.push({
        hour: h.toLocaleTimeString('en', { hour: '2-digit', hour12: false }),
        count: hourEvents.length,
        critical: hourEvents.filter(e => e.severity === 'critical' || e.severity === 'high').length,
      });
    }
    return hours;
  }, [events]);

  // ── Severity distribution ──
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => { counts[e.severity] = (counts[e.severity] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: SEVERITY_COLORS[name] || 'hsl(var(--muted))' }));
  }, [events]);

  // ── Event timeline (7 days) ──
  const timelineData = useMemo(() => {
    const days: Record<string, { date: string; critical: number; high: number; medium: number; low: number; info: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: d.toLocaleDateString('en', { weekday: 'short' }), critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }
    events.forEach(e => {
      const key = e.created_at.slice(0, 10);
      if (days[key] && (e.severity as string) in days[key]) {
        (days[key] as any)[e.severity]++;
      }
    });
    return Object.values(days);
  }, [events]);

  // ── Device status ──
  const deviceStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      fill: name === 'online' ? 'hsl(142, 71%, 45%)' : name === 'offline' ? 'hsl(0, 84%, 60%)' : 'hsl(48, 96%, 53%)',
    }));
  }, [devices]);

  // ── Active alerts by site ──
  const alertsBySite = useMemo(() => {
    return sites.map(site => {
      const siteEvents = events.filter(e => e.site_id === site.id && (e.status === 'new' || e.status === 'acknowledged'));
      return {
        name: site.name?.split('—')[0]?.trim()?.slice(0, 15) || 'Unknown',
        alerts: siteEvents.length,
        critical: siteEvents.filter(e => e.severity === 'critical').length,
      };
    }).filter(s => s.alerts > 0).sort((a, b) => b.alerts - a.alerts).slice(0, 8);
  }, [sites, events]);

  const stats = [
    { label: t('dashboard.total_devices'), value: devices.length, sub: `${onlineDevices} ${t('dashboard.online')} · ${offlineDevices} ${t('dashboard.offline')}`, icon: <MonitorSpeaker className="h-5 w-5" />, color: 'text-primary', path: '/devices' },
    { label: t('dashboard.active_alerts'), value: activeEvents, sub: `${criticalEvents} ${t('dashboard.critical_high')}`, icon: <Bell className="h-5 w-5" />, color: 'text-warning', path: '/events' },
    { label: t('dashboard.sites'), value: sites.length, sub: `${sites.filter(s => s.status === 'healthy').length} ${t('dashboard.healthy')}`, icon: <MapPin className="h-5 w-5" />, color: 'text-info', path: '/sites' },
    { label: t('dashboard.system_health'), value: `${healthChecks.filter(h => h.status === 'healthy').length}/${healthChecks.length || '—'}`, sub: t('dashboard.components_ok'), icon: <Activity className="h-5 w-5" />, color: 'text-success', path: '/system' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-popover p-2 shadow-md text-xs">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span className="capitalize">{p.dataKey}: {p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {permission !== 'granted' ? (
            <Button variant="outline" size="sm" onClick={subscribe}>
              <BellRing className="mr-2 h-4 w-4" /> {t('dashboard.enable_notifications')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={unsubscribe} className="text-muted-foreground">
              <BellOff className="mr-2 h-4 w-4" /> {isSubscribed ? t('dashboard.disable_notifications') : t('dashboard.notifications_on')}
            </Button>
          )}
          <Button onClick={() => navigate('/live-view')}>
            <Video className="mr-2 h-4 w-4" /> {t('dashboard.open_live_view')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <Card key={stat.label} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(stat.path)}>
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-12" /><Skeleton className="h-3 w-16" /></div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                  </div>
                  <div className={stat.color}>{stat.icon}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events per Hour + Device Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> {t('dashboard.events_per_hour')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEvents ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={eventsPerHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.7} />
                  <Bar dataKey="critical" name="Critical/High" fill={SEVERITY_COLORS.critical} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MonitorSpeaker className="h-4 w-4" /> {t('dashboard.device_status')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDevices ? <Skeleton className="h-52 w-full" /> : deviceStatusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">{t('dashboard.no_devices')}</p>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={deviceStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {deviceStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-1">
                  {deviceStatusData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                      <span className="capitalize">{d.name}: {d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Timeline + Active Alerts by Site */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.event_timeline')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEvents ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="critical" stackId="1" stroke={SEVERITY_COLORS.critical} fill={SEVERITY_COLORS.critical} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="high" stackId="1" stroke={SEVERITY_COLORS.high} fill={SEVERITY_COLORS.high} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="medium" stackId="1" stroke={SEVERITY_COLORS.medium} fill={SEVERITY_COLORS.medium} fillOpacity={0.4} />
                  <Area type="monotone" dataKey="low" stackId="1" stroke={SEVERITY_COLORS.low} fill={SEVERITY_COLORS.low} fillOpacity={0.3} />
                  <Area type="monotone" dataKey="info" stackId="1" stroke={SEVERITY_COLORS.info} fill={SEVERITY_COLORS.info} fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> {t('dashboard.active_alerts_by_site')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEvents || loadingSites ? <Skeleton className="h-48 w-full" /> : alertsBySite.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2" />
                <p className="text-sm">{t('dashboard.no_active_alerts')}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={alertsBySite} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="alerts" name="Total Alerts" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} opacity={0.5} />
                  <Bar dataKey="critical" name="Critical" fill={SEVERITY_COLORS.critical} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Severity + Recent Events + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.severity_distribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEvents ? <Skeleton className="h-48 w-full" /> : severityData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">{t('dashboard.no_events')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {severityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('dashboard.recent_events')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/events')}>{t('dashboard.view_all')} <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingEvents ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2"><Skeleton className="h-4 w-4 rounded-full" /><div className="flex-1 space-y-1"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/3" /></div></div>
            )) : events.slice(0, 5).map(event => (
              <div key={event.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="mt-0.5">
                  {event.severity === 'critical' ? <XCircle className="h-4 w-4 text-destructive" /> :
                   event.severity === 'high' ? <AlertTriangle className="h-4 w-4 text-warning" /> :
                   <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={event.status === 'new' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">{event.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('dashboard.system_health_card')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/system')}>{t('dashboard.details')} <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {healthChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dashboard.loading_health')}</p>
            ) : healthChecks.map(h => (
              <div key={h.component} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                {statusIcon(h.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{h.component}</p>
                  {h.latency_ms && <p className="text-xs text-muted-foreground">{h.latency_ms}ms</p>}
                </div>
                <Badge variant={h.status === 'healthy' ? 'secondary' : h.status === 'degraded' ? 'outline' : 'destructive'} className="text-[10px]">{h.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t('dashboard.devices_by_site')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {loadingSites ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2"><Skeleton className="h-4 w-4 rounded-full" /><div className="flex-1 space-y-1"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>
            )) : sites.map(site => {
              const siteDevices = devices.filter(d => d.site_id === site.id);
              const online = siteDevices.filter(d => d.status === 'online').length;
              return (
                <div key={site.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/sites')}>
                  {statusIcon(site.status)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{site.name}</p>
                    <p className="text-xs text-muted-foreground">{online}/{siteDevices.length} {t('dashboard.devices_online')}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t('dashboard.quick_actions')}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate('/devices')}><MonitorSpeaker className="h-5 w-5" /><span className="text-xs">{t('dashboard.add_device')}</span></Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate('/live-view')}><Video className="h-5 w-5" /><span className="text-xs">{t('nav.live_view')}</span></Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate('/incidents')}><AlertTriangle className="h-5 w-5" /><span className="text-xs">{t('dashboard.new_incident')}</span></Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate('/ai-assistant')}><Activity className="h-5 w-5" /><span className="text-xs">{t('nav.ai_assistant')}</span></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
