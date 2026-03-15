import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/contexts/I18nContext';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280',
  info: '#8b5cf6',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#f59e0b',
  investigating: '#3b82f6',
  resolved: '#22c55e',
  closed: '#6b7280',
};

const DEVICE_COLORS: Record<string, string> = {
  online: '#22c55e',
  offline: '#ef4444',
  degraded: '#f59e0b',
  unknown: '#6b7280',
};

interface ReportsChartsProps {
  events: any[];
  incidents: any[];
  devices: any[];
}

export default function ReportsCharts({ events, incidents, devices }: ReportsChartsProps) {
  const { t } = useI18n();

  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => { counts[e.severity] = (counts[e.severity] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  const trendData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    events.forEach(e => {
      const day = e.created_at?.slice(0, 10);
      if (day && day in days) days[day]++;
    });
    return Object.entries(days).map(([date, count]) => ({
      date: date.slice(5), // MM-DD
      count,
    }));
  }, [events]);

  const incidentStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const deviceStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [devices]);

  if (!events.length && !incidents.length && !devices.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('reports.charts_title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Events by Severity - Bar Chart */}
          {severityData.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">{t('reports.events_by_severity')}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={severityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {severityData.map((entry) => (
                      <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Event Trend - Line Chart */}
          {trendData.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">{t('reports.events_trend')}</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Incidents by Status - Pie Chart */}
          {incidentStatusData.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">{t('reports.incidents_by_status')}</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={incidentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {incidentStatusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Devices by Status - Pie Chart */}
          {deviceStatusData.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">{t('reports.devices_by_status')}</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={deviceStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {deviceStatusData.map((entry) => (
                      <Cell key={entry.name} fill={DEVICE_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
