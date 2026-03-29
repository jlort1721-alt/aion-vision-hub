import { useQuery } from "@tanstack/react-query";
import ErrorState from "@/components/ui/ErrorState";
import {
  analyticsDashboardApi,
  analyticsEventsApi,
  analyticsIncidentsApi,
  analyticsDevicesApi,
} from "@/services/analytics-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Cpu, ShieldCheck, Target, Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AnalyticsPage() {
  // ── Dashboard KPIs ───────────────────────────────────────
  const { data: dashboardData, isLoading: loadingDashboard, isError, error, refetch } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => analyticsDashboardApi.get(),
    refetchInterval: 60000,
  });

  // ── Event Trends ─────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const { data: trendsData, isLoading: loadingTrends } = useQuery({
    queryKey: ["analytics", "events", "trends"],
    queryFn: () => analyticsEventsApi.trends({ from: thirtyDaysAgo, to: today, period: "day" }),
  });

  // ── Top Event Types ──────────────────────────────────────
  const { data: topTypesData } = useQuery({
    queryKey: ["analytics", "events", "top-types"],
    queryFn: () => analyticsEventsApi.topTypes(),
  });

  // ── Incident Metrics ─────────────────────────────────────
  const { data: incidentData } = useQuery({
    queryKey: ["analytics", "incidents", "metrics"],
    queryFn: () => analyticsIncidentsApi.metrics(),
  });

  // ── Device Status ────────────────────────────────────────
  const { data: devicesData } = useQuery({
    queryKey: ["analytics", "devices", "status"],
    queryFn: () => analyticsDevicesApi.status(),
  });

  const dashboard = dashboardData?.data;
  const trends = trendsData?.data ?? [];
  const topTypes = topTypesData?.data ?? [];
  const incidents = incidentData?.data;
  const devices = devicesData?.data ?? [];

  const incidentStatusConfig: { key: string; label: string; color: string }[] = [
    { key: "open", label: "Open", color: "bg-red-500" },
    { key: "in_progress", label: "In Progress", color: "bg-yellow-500" },
    { key: "resolved", label: "Resolved", color: "bg-green-500" },
    { key: "closed", label: "Closed", color: "bg-gray-500" },
  ];

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground">
          Real-time analytics and operational insights
        </p>
      </div>

      {/* KPI Cards */}
      {loadingDashboard ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Events 24h</p>
                  <p className="text-2xl font-bold">{dashboard?.events24h ?? 0}</p>
                </div>
                <Activity className="h-6 w-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Incidents</p>
                  <p className="text-2xl font-bold text-red-500">{dashboard?.activeIncidents ?? 0}</p>
                </div>
                <ShieldCheck className="h-6 w-6 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Devices Online</p>
                  <p className="text-2xl font-bold text-green-500">{dashboard?.devicesOnline ?? 0}</p>
                </div>
                <Cpu className="h-6 w-6 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">SLA Compliance</p>
                  <p className="text-2xl font-bold">
                    {dashboard?.slaCompliance != null ? `${Math.round(dashboard.slaCompliance)}%` : '--'}
                  </p>
                </div>
                <Target className="h-6 w-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Patrol Compliance</p>
                  <p className="text-2xl font-bold">
                    {dashboard?.patrolCompliance != null ? `${Math.round(dashboard.patrolCompliance)}%` : '--'}
                  </p>
                </div>
                <ShieldCheck className="h-6 w-6 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Alert Count</p>
                  <p className="text-2xl font-bold text-yellow-500">{dashboard?.alertCount ?? 0}</p>
                </div>
                <TrendingUp className="h-6 w-6 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Event Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Event Trends (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTrends ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : trends.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              No event data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const d = new Date(value);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorEvents)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Third Row: Top Event Types + Incident Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Event Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Event Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topTypes.length === 0 ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                No event type data available
              </div>
            ) : (
              <div className="space-y-3">
                {topTypes.map((item: any) => (
                  <div key={item.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.type}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(item.percentage ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Incident Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Incident Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!incidents ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                No incident data available
              </div>
            ) : (
              <div className="space-y-4">
                {incidentStatusConfig.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <span className="text-2xl font-bold">
                      {(incidents as Record<string, number>)[key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fourth Row: Device Status by Site */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Device Status by Site
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              No device status data available
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((site: any) => {
                const total = site.total || (site.online + site.offline) || 1;
                const onlinePercent = Math.round((site.online / total) * 100);
                return (
                  <div key={site.site} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{site.site}</span>
                      <span className="text-muted-foreground">
                        <span className="text-green-500">{site.online} online</span>
                        {' / '}
                        <span className="text-red-500">{site.offline} offline</span>
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 rounded-full h-2 transition-all"
                        style={{ width: `${onlinePercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
