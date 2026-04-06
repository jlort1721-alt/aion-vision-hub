import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { reportsApi } from '@/services/reports-api';
import { useSites } from '@/hooks/use-api-data';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  FileBarChart, Download, Trash2, Loader2, ChevronLeft, ChevronRight,
  FileText, Clock, CheckCircle2, XCircle, FileSpreadsheet, AlertTriangle,
} from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import ErrorState from '@/components/ui/ErrorState';

// ── Constants ─────────────────────────────────────────────

const PAGE_SIZE = 25;

const REPORT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'events', label: 'Events' },
  { value: 'incidents', label: 'Incidents' },
  { value: 'devices', label: 'Devices' },
  { value: 'access_logs', label: 'Access Logs' },
  { value: 'shifts', label: 'Shifts' },
  { value: 'patrols', label: 'Patrols' },
] as const;

const FORMAT_OPTIONS = [
  { value: 'PDF', label: 'PDF' },
  { value: 'CSV', label: 'CSV' },
  { value: 'XLSX', label: 'XLSX' },
] as const;

// ── Helpers ───────────────────────────────────────────────

const statusConfig: Record<string, { icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { icon: <CheckCircle2 className="h-3 w-3 mr-1" />, variant: 'secondary' },
  processing: { icon: <Clock className="h-3 w-3 mr-1 animate-spin" />, variant: 'outline' },
  failed: { icon: <XCircle className="h-3 w-3 mr-1" />, variant: 'destructive' },
};

const typeColors: Record<string, string> = {
  events: 'bg-primary/10 text-primary',
  incidents: 'bg-destructive/10 text-destructive',
  devices: 'bg-success/10 text-success',
  access_logs: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  shifts: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  patrols: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Filters ───────────────────────────────────────────────

interface ReportFilters {
  type: string;
  site_id: string;
  date_from: string;
  date_to: string;
  format: string;
  page: number;
}

const defaultFilters: ReportFilters = {
  type: 'all',
  site_id: 'all',
  date_from: '',
  date_to: '',
  format: 'PDF',
  page: 1,
};

// ── Component ─────────────────────────────────────────────

export default function ReportsPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: sites = [] } = useSites();

  // ── List Query ────────────────────────────────────────

  const queryFilters: Record<string, string | number | boolean | undefined> = {
    page: filters.page,
    perPage: PAGE_SIZE,
  };
  if (filters.type !== 'all') queryFilters.type = filters.type;
  if (filters.site_id !== 'all') queryFilters.site_id = filters.site_id;
  if (filters.date_from) queryFilters.date_from = filters.date_from;
  if (filters.date_to) queryFilters.date_to = filters.date_to;

  const { data: result, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', queryFilters],
    queryFn: () => reportsApi.list(queryFilters),
    enabled: isAuthenticated,
  });

  const reports = result?.data ?? [];
  const totalCount = result?.meta?.total ?? reports.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Stats ─────────────────────────────────────────────

  const totalReports = totalCount;
  const todayStr = new Date().toISOString().slice(0, 10);
  const generatedToday = reports.filter(
    (r: any) => r.created_at?.slice(0, 10) === todayStr
  ).length;
  const pendingCount = reports.filter(
    (r: any) => r.status === 'processing'
  ).length;

  // ── Generate Mutation ─────────────────────────────────

  const generateMutation = useMutation({
    mutationFn: (params: { type: string; site_id?: string; date_from: string; date_to: string; format: string }) =>
      reportsApi.generate(params),
    onSuccess: () => {
      toast.success(t('reports.generate_success') || 'Report generation started');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to generate report');
    },
  });

  // ── Delete Mutation ───────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => {
      toast.success(t('reports.delete_success') || 'Report deleted');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete report');
    },
  });

  // ── Handlers ──────────────────────────────────────────

  const updateFilters = useCallback((partial: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...partial, ...(partial.page === undefined ? { page: 1 } : {}) }));
  }, []);

  const resetFilters = useCallback(() => setFilters(defaultFilters), []);

  const handleGenerate = () => {
    if (!filters.date_from || !filters.date_to) {
      toast.error(t('reports.date_required') || 'Please select a date range');
      return;
    }
    if (filters.type === 'all') {
      toast.error(t('reports.type_required') || 'Please select a report type');
      return;
    }
    setGenerating(true);
    generateMutation.mutate(
      {
        type: filters.type,
        site_id: filters.site_id !== 'all' ? filters.site_id : undefined,
        date_from: filters.date_from,
        date_to: filters.date_to,
        format: filters.format,
      },
      { onSettled: () => setGenerating(false) }
    );
  };

  const handleDownload = async (report: any) => {
    try {
      const blob = await reportsApi.download(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.name || `report-${report.id}.${(report.format || 'pdf').toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('reports.download_started') || 'Download started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const setPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  // ── Render ────────────────────────────────────────────

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title={t('reports.title')}
      description={t('reports.subtitle')}
      icon={<FileBarChart className="h-5 w-5" />}
    >
      <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileBarChart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? '--' : totalReports}</p>
              <p className="text-xs text-muted-foreground">{t('reports.total_reports') || 'Total Reports'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? '--' : generatedToday}</p>
              <p className="text-xs text-muted-foreground">{t('reports.generated_today') || 'Generated Today'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? '--' : pendingCount}</p>
              <p className="text-xs text-muted-foreground">{t('reports.pending') || 'Pending'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Report Type */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.type') || 'Report Type'}</label>
              <Select value={filters.type} onValueChange={(v) => updateFilters({ type: v })}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('common.from_date') || 'From'}</label>
              <Input
                type="date"
                className="w-[150px] h-9 text-sm"
                value={filters.date_from}
                onChange={(e) => updateFilters({ date_from: e.target.value })}
              />
            </div>

            {/* Date To */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('common.to_date') || 'To'}</label>
              <Input
                type="date"
                className="w-[150px] h-9 text-sm"
                value={filters.date_to}
                onChange={(e) => updateFilters({ date_to: e.target.value })}
              />
            </div>

            {/* Site Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('events.site') || 'Site'}</label>
              <Select value={filters.site_id} onValueChange={(v) => updateFilters({ site_id: v })}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all') || 'All Sites'}</SelectItem>
                  {sites.map((site: any) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name?.split('—')[0]?.trim() || site.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('reports.format') || 'Format'}</label>
              <Select value={filters.format} onValueChange={(v) => updateFilters({ format: v })}>
                <SelectTrigger className="w-[100px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={resetFilters}>
                {t('common.clear') || 'Clear'}
              </Button>
              <Button size="sm" className="h-9 text-sm" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t('reports.generate') || 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('reports.list') || 'Reports'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">{t('reports.no_reports') || 'No reports found'}</p>
              <p className="text-xs mt-1">{t('reports.no_reports_desc') || 'Generate a report using the filters above'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.name') || 'Name'}</TableHead>
                      <TableHead>{t('reports.type') || 'Type'}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('reports.date_range') || 'Date Range'}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('reports.format') || 'Format'}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('reports.created_at') || 'Created'}</TableHead>
                      <TableHead>{t('common.status') || 'Status'}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('reports.size') || 'Size'}</TableHead>
                      <TableHead className="text-right">{t('common.actions') || 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report: any) => {
                      const statusCfg = statusConfig[report.status] || statusConfig.completed;
                      const typeColor = typeColors[report.type] || 'bg-muted text-muted-foreground';
                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium truncate max-w-[200px]">
                                {report.name || `${report.type}-report`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px] capitalize', typeColor)}>
                              {(report.type || '').replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {formatDate(report.date_from)} - {formatDate(report.date_to)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="text-[10px]">
                              {(report.format || 'PDF').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDateTime(report.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusCfg.variant} className="text-[10px] capitalize">
                              {statusCfg.icon}
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {formatFileSize(report.size)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={report.status !== 'completed'}
                                onClick={() => handleDownload(report)}
                                title={t('common.download') || 'Download'}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ id: report.id, name: report.name || report.type })}
                                title={t('common.delete') || 'Delete'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-2 border-t flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {totalCount} {t('reports.count') || 'reports'} · {t('events.page') || 'Page'} {filters.page} {t('events.of') || 'of'} {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={filters.page <= 1}
                    onClick={() => setPage(filters.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const current = filters.page;
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (current <= 3) pageNum = i + 1;
                    else if (current >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = current - 2 + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === current ? 'default' : 'outline'}
                        size="icon"
                        className="h-7 w-7 text-xs"
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={filters.page >= totalPages}
                    onClick={() => setPage(filters.page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reports.delete_title') || 'Delete Report'}</DialogTitle>
            <DialogDescription>
              {t('reports.delete_confirm') || 'Are you sure you want to delete'}{' '}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>?{' '}
              {t('reports.delete_warning') || 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('common.delete') || 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  );
}
