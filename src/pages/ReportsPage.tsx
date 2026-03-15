import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDevices, useEventsLegacy, useIncidents, useAiSessions } from '@/hooks/use-supabase-data';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { FileBarChart, Download, BarChart3, TrendingUp, PieChart, Bot, FileText, Loader2, CalendarIcon, FileSpreadsheet } from 'lucide-react';
import ReportsCharts from '@/components/reports/ReportsCharts';

function exportCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(row =>
    headers.map(h => {
      const val = row[h];
      const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  )].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportXLSX(data: any[], filename: string) {
  if (!data.length) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

export default function ReportsPage() {
  const { t } = useI18n();
  const { data: events = [], isLoading: le } = useEventsLegacy();
  const { data: incidents = [], isLoading: li } = useIncidents();
  const { data: devices = [], isLoading: ld } = useDevices();
  const { data: aiSessions = [] } = useAiSessions();
  const [exportingPdf, setExportingPdf] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const loading = le || li || ld;

  const exportPdf = async (type: string) => {
    setExportingPdf(type);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reports-pdf?type=${type}`;
      if (dateFrom) url += `&from=${dateFrom.toISOString()}`;
      if (dateTo) url += `&to=${dateTo.toISOString()}`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${type}-report-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success(t('common.export') + ' ✓');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportingPdf(null);
    }
  };

  const reports = [
    {
      name: t('reports.events_summary'), description: t('reports.events_desc'),
      icon: <BarChart3 className="h-8 w-8 text-primary" />, count: events.length, pdfType: 'events',
      onCSV: () => exportCSV(events, 'events-report.csv'),
      onXLSX: () => exportXLSX(events, 'events-report.xlsx'),
    },
    {
      name: t('reports.incident_report'), description: t('reports.incident_desc'),
      icon: <TrendingUp className="h-8 w-8 text-warning" />, count: incidents.length, pdfType: 'incidents',
      onCSV: () => exportCSV(incidents.map(({ comments, ...rest }) => rest), 'incidents-report.csv'),
      onXLSX: () => exportXLSX(incidents.map(({ comments, ...rest }) => rest), 'incidents-report.xlsx'),
    },
    {
      name: t('reports.device_health'), description: t('reports.device_desc'),
      icon: <PieChart className="h-8 w-8 text-success" />, count: devices.length, pdfType: 'devices',
      onCSV: () => exportCSV(devices.map(({ capabilities, ...rest }) => rest), 'devices-report.csv'),
      onXLSX: () => exportXLSX(devices.map(({ capabilities, ...rest }) => rest), 'devices-report.xlsx'),
    },
    {
      name: t('reports.ai_usage'), description: t('reports.ai_desc'),
      icon: <Bot className="h-8 w-8 text-info" />, count: aiSessions.length, pdfType: 'summary',
      onCSV: () => exportCSV(aiSessions.map(({ messages, ...rest }) => rest), 'ai-usage-report.csv'),
      onXLSX: () => exportXLSX(aiSessions.map(({ messages, ...rest }) => rest), 'ai-usage-report.xlsx'),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "MMM d, yyyy") : t('common.from_date')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "MMM d, yyyy") : t('common.to_date')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              {t('common.clear')}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(report => (
            <Card key={report.name} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">{report.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-bold">{report.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{report.description}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Badge variant="outline" className="text-xs">{report.count} {t('common.records')}</Badge>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={report.onCSV}>
                        <Download className="mr-1 h-3 w-3" /> CSV
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={report.onXLSX}>
                        <FileSpreadsheet className="mr-1 h-3 w-3" /> XLSX
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportPdf(report.pdfType)} disabled={exportingPdf === report.pdfType}>
                        {exportingPdf === report.pdfType ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileText className="mr-1 h-3 w-3" />} PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReportsCharts events={events} incidents={incidents} devices={devices} />

      <Card>
        <CardHeader><CardTitle className="text-base">{t('reports.quick_summary')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{events.length}</p>
              <p className="text-xs text-muted-foreground">{t('reports.total_events')}</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold text-destructive">{events.filter(e => e.severity === 'critical').length}</p>
              <p className="text-xs text-muted-foreground">{t('reports.critical')}</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold text-success">{events.filter(e => e.status === 'resolved').length}</p>
              <p className="text-xs text-muted-foreground">{t('reports.resolved')}</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{devices.filter(d => d.status === 'online').length}/{devices.length}</p>
              <p className="text-xs text-muted-foreground">{t('reports.devices_online')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
