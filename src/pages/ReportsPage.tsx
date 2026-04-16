import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { reportsApi } from '@/services/reports-api';
import { useSites } from '@/hooks/use-api-data';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  FileBarChart, Download, Trash2, Loader2, ChevronLeft, ChevronRight,
  FileText, Clock, CheckCircle2, XCircle,
  Calendar, Building2, Filter
} from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/shared/EmptyState';
import { useI18n } from '@/contexts/I18nContext';

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const PAGE_SIZE = 25;

const REPORT_TYPES = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'events', label: 'Eventos' },
  { value: 'incidents', label: 'Incidentes' },
  { value: 'devices', label: 'Dispositivos' },
  { value: 'access', label: 'Control de Acceso' },
] as const;

// Backend only supports pdf, csv, json (lowercase)
const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
] as const;

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completed: { label: 'Completado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  ready: { label: 'Listo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  pending: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Clock },
  generating: { label: 'Generando', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: Loader2 },
  failed: { label: 'Fallido', color: 'bg-red-500/10 text-red-400 border-red-500/30', icon: XCircle },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  events: { label: 'Eventos', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  incidents: { label: 'Incidentes', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  devices: { label: 'Dispositivos', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  access: { label: 'Acceso', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  access_logs: { label: 'Acceso', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  audit: { label: 'Auditoría', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  custom: { label: 'Personalizado', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

interface ReportFilters {
  type: string;
  site_id: string;
  date_from: string;
  date_to: string;
  format: string;
  page: number;
}

const defaultFilters: ReportFilters = {
  type: 'all', site_id: 'all', date_from: '', date_to: '', format: 'pdf', page: 1,
};

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

export default function ReportsPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: rawSites = [] } = useSites();
  const sites = rawSites as Record<string, unknown>[];

  // ── List Query ──
  const queryFilters: Record<string, string | number | boolean | undefined> = {
    page: filters.page,
    perPage: PAGE_SIZE,
  };
  if (filters.type !== 'all') queryFilters.type = filters.type;

  const { data: result, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', queryFilters],
    queryFn: () => reportsApi.list(queryFilters),
    enabled: isAuthenticated,
  });

  const resultEnvelope = result as Record<string, unknown> | unknown[] | undefined;
  const reports: Record<string, unknown>[] = (!Array.isArray(resultEnvelope) && resultEnvelope ? resultEnvelope.data as Record<string, unknown>[] : undefined) ?? (Array.isArray(result) ? result as Record<string, unknown>[] : []);
  const totalCount: number = Number((!Array.isArray(resultEnvelope) && resultEnvelope?.meta ? (resultEnvelope.meta as Record<string, unknown>).total : undefined) ?? reports.length);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Stats ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const generatedToday = reports.filter((r: any) => (r.createdAt || r.created_at || '')?.slice(0, 10) === todayStr).length;
  const pendingCount = reports.filter((r: any) => r.status === 'pending' || r.status === 'generating').length;

  // ── Generate ──
  const generateMutation = useMutation({
    mutationFn: (params: { type: string; site_id?: string; date_from: string; date_to: string; format: string }) =>
      reportsApi.generate(params),
    onSuccess: () => {
      toast.success(t('reports.report_generated'));
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: Error) => toast.error(err.message || t('reports.error_generating')),
  });

  // ── Delete ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => { toast.success(t('reports.report_deleted')); queryClient.invalidateQueries({ queryKey: ['reports'] }); setDeleteTarget(null); },
    onError: (err: Error) => toast.error(err.message || t('reports.error_deleting')),
  });

  // ── Handlers ──
  const updateFilters = useCallback((partial: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...partial, ...(partial.page === undefined ? { page: 1 } : {}) }));
  }, []);

  const handleGenerate = () => {
    if (!filters.date_from || !filters.date_to) { toast.error(t('reports.select_date_range')); return; }
    if (filters.type === 'all') { toast.error(t('reports.select_report_type')); return; }
    setGenerating(true);
    generateMutation.mutate(
      { type: filters.type, site_id: filters.site_id !== 'all' ? filters.site_id : undefined, date_from: filters.date_from, date_to: filters.date_to, format: filters.format },
      { onSettled: () => setGenerating(false) }
    );
  };

  const handleDownload = async (report: any) => {
    try {
      const blob = await reportsApi.download(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.name || `reporte-${report.type || 'data'}.${report.format || 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('reports.download_started'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('reports.error_downloading'));
    }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title={t('reports.page_title')}
      description={t('reports.page_subtitle')}
      icon={<FileBarChart className="h-5 w-5" />}
    >
      <div className="p-5 space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={<FileBarChart className="h-5 w-5 text-blue-400" />} label={t('reports.total_reports')} value={isLoading ? '—' : String(totalCount)} color="text-blue-400" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} label={t('reports.generated_today')} value={isLoading ? '—' : String(generatedToday)} color="text-emerald-400" />
        <StatCard icon={<Clock className="h-5 w-5 text-amber-400" />} label={t('reports.pending')} value={isLoading ? '—' : String(pendingCount)} color="text-amber-400" />
      </div>

      {/* Filter Bar */}
      <Card className="bg-slate-800/40 border-slate-700/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1"><Filter className="h-3 w-3" /> {t('reports.filter_type')}</label>
              <Select value={filters.type} onValueChange={v => updateFilters({ type: v })}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>{REPORT_TYPES.map(rt => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> {t('reports.filter_from')}</label>
              <Input type="date" className="w-[140px] h-8 text-xs bg-slate-900/50 border-slate-700" value={filters.date_from} onChange={e => updateFilters({ date_from: e.target.value })} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> {t('reports.filter_to')}</label>
              <Input type="date" className="w-[140px] h-8 text-xs bg-slate-900/50 border-slate-700" value={filters.date_to} onChange={e => updateFilters({ date_to: e.target.value })} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex items-center gap-1"><Building2 className="h-3 w-3" /> {t('reports.filter_site')}</label>
              <Select value={filters.site_id} onValueChange={v => updateFilters({ site_id: v })}>
                <SelectTrigger className="w-[170px] h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.all_sites')}</SelectItem>
                  {sites.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name?.split('—')[0]?.trim() || s.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">{t('reports.filter_format')}</label>
              <Select value={filters.format} onValueChange={v => updateFilters({ format: v })}>
                <SelectTrigger className="w-[90px] h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilters(defaultFilters)}>{t('reports.clear_filters')}</Button>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                {t('reports.generate')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="bg-slate-800/30 border-slate-700/40">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-1.5"><FileBarChart className="h-4 w-4 text-blue-400" /> {t('reports.generated_reports')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('reports.no_reports')}
              description={t('reports.no_reports_desc')}
            />
          ) : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700/50">
                      <TableHead className="text-xs">{t('reports.col_name')}</TableHead>
                      <TableHead className="text-xs">{t('reports.col_type')}</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">{t('reports.col_format')}</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">{t('reports.col_created')}</TableHead>
                      <TableHead className="text-xs">{t('reports.col_status')}</TableHead>
                      <TableHead className="text-xs text-right">{t('reports.col_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report: any) => {
                      const sc = statusConfig[report.status] || statusConfig.pending;
                      const tc = typeConfig[report.type] || typeConfig.events;
                      const StatusIcon = sc.icon;
                      const isDownloadable = report.status === 'completed' || report.status === 'ready';
                      return (
                        <TableRow key={report.id} className="border-slate-800">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                              <span className="text-sm font-medium text-white truncate max-w-[200px]">
                                {report.name || `${report.type}-reporte`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[9px] border", tc.color)}>{tc.label}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className="text-[9px] font-mono">{(report.format || 'json').toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-slate-400">
                            {formatDateTime(report.createdAt || report.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[9px] border gap-1", sc.color)}>
                              <StatusIcon className={cn("h-2.5 w-2.5", report.status === 'generating' && "animate-spin")} />
                              {sc.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!isDownloadable} onClick={() => handleDownload(report)} title={t('reports.download')} aria-label={t('reports.download')}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => setDeleteTarget({ id: report.id, name: report.name || report.type })} title={t('common.delete')} aria-label={t('common.delete')}>
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
              {totalPages > 1 && (
                <div className="px-4 py-2 border-t border-slate-700/50 flex items-center justify-between text-sm">
                  <span className="text-xs text-slate-500">{totalCount} reportes &bull; Página {filters.page} de {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={filters.page <= 1} onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))} aria-label="Página anterior">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = filters.page;
                      let num: number;
                      if (totalPages <= 5) num = i + 1;
                      else if (p <= 3) num = i + 1;
                      else if (p >= totalPages - 2) num = totalPages - 4 + i;
                      else num = p - 2 + i;
                      return (
                        <Button key={num} variant={num === p ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs" onClick={() => setFilters(prev => ({ ...prev, page: num }))}>
                          {num}
                        </Button>
                      );
                    })}
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={filters.page >= totalPages} onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))} aria-label="Página siguiente">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reports.delete_report')}</DialogTitle>
            <DialogDescription>
              ¿Eliminar <span className="font-medium text-white">{deleteTarget?.name}</span>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="gap-1">
              {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Card className="bg-slate-800/40 border-slate-700/50">
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div>
          <p className={cn("text-2xl font-bold", color)}>{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
