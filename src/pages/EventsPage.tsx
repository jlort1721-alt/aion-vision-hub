import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEvents, useDevices, useSites, type EventFilters } from '@/hooks/use-api-data';
import { useRealtimeEvents } from '@/hooks/use-realtime-events';
import { useAudioAlerts } from '@/hooks/use-audio-alerts';
import { apiClient } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import {
  XCircle, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Bot, MoreHorizontal, ChevronLeft, ChevronRight,
  Volume2, VolumeX, Loader2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import EventFiltersBar from '@/components/events/EventFiltersBar';
import EventDetailPanel from '@/components/events/EventDetailPanel';
import { PageShell } from '@/components/shared/PageShell';
import ErrorState from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/SkeletonVariants';

const severityConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  critical: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
  high: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-warning' },
  medium: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-info' },
  low: { icon: <Info className="h-4 w-4" />, color: 'text-muted-foreground' },
  info: { icon: <Info className="h-4 w-4" />, color: 'text-muted-foreground' },
};

const PAGE_SIZE = 25;

const defaultFilters: EventFilters = {
  search: '', severity: 'all', status: 'all', device_id: 'all', site_id: 'all',
  date_from: undefined, date_to: undefined, page: 1, pageSize: PAGE_SIZE,
};

export default function EventsPage() {
  const { t } = useI18n();
  const [filters, setFilters] = useState<EventFilters>(defaultFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Audio alerts
  const { playAlert, isMuted, toggleMute } = useAudioAlerts();
  const prevEventCountRef = useRef<number | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<{ action: string; done: number; total: number } | null>(null);

  const { data: result, isLoading, isError, error, refetch } = useEvents(filters);
  const events = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: devices = [] } = useDevices();
  const { data: sites = [] } = useSites();
  const queryClient = useQueryClient();
  useRealtimeEvents();

  // Play audio alert when new events arrive
  useEffect(() => {
    if (prevEventCountRef.current !== null && events.length > 0) {
      const prevCount = prevEventCountRef.current;
      if (totalCount > prevCount && events[0]) {
        const severity = (events[0] as any).severity as 'critical' | 'high' | 'medium' | 'low' | 'info';
        playAlert(severity);
      }
    }
    prevEventCountRef.current = totalCount;
  }, [totalCount, events, playAlert]);

  // Toggle single row selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Select all / deselect all on current page
  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const allOnPage = events.map(e => e.id);
      const allSelected = allOnPage.every(id => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allOnPage);
    });
  }, [events]);

  // Bulk action handler
  const handleBulkAction = useCallback(async (action: 'acknowledge' | 'resolve' | 'dismiss') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading({ action, done: 0, total: ids.length });

    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        switch (action) {
          case 'acknowledge': await apiClient.edgeFunction('events-api', { id: ids[i], action: 'acknowledge' }, { method: 'POST' }); break;
          case 'resolve': await apiClient.edgeFunction('events-api', { id: ids[i], action: 'resolve' }, { method: 'POST' }); break;
          case 'dismiss': await apiClient.edgeFunction('events-api', { id: ids[i], action: 'dismiss' }, { method: 'POST' }); break;
        }
        successCount++;
      } catch { /* continue with remaining */ }
      setBulkLoading({ action, done: i + 1, total: ids.length });
    }

    queryClient.invalidateQueries({ queryKey: ['events'] });
    setSelectedIds(new Set());
    setBulkLoading(null);
    toast.success(`${action}: ${successCount}/${ids.length} events processed`);
  }, [selectedIds, queryClient]);

  const updateFilters = useCallback((partial: Partial<EventFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
  }, []);
  const resetFilters = useCallback(() => setFilters(defaultFilters), []);
  const selectedEvent = selected ? events.find(e => e.id === selected) : null;

  const handleAction = async (eventId: string, action: string) => {
    setActionLoading(action);
    try {
      switch (action) {
        case 'acknowledge': await apiClient.edgeFunction('events-api', { id: eventId, action: 'acknowledge' }, { method: 'POST' }); toast.success(t('events.acknowledged')); break;
        case 'resolve': await apiClient.edgeFunction('events-api', { id: eventId, action: 'resolve' }, { method: 'POST' }); toast.success(t('events.resolved')); break;
        case 'dismiss': await apiClient.edgeFunction('events-api', { id: eventId, action: 'dismiss' }, { method: 'POST' }); toast.success(t('events.dismissed')); break;
        case 'ai-summary': await apiClient.edgeFunction('events-api', { id: eventId, action: 'ai-summary' }, { method: 'POST' }); toast.success(t('events.ai_summary')); break;
        case 'create-incident': {
          const event = events.find(e => e.id === eventId);
          if (event) {
            const incidentData = {
              title: `Incident: ${event.title}`, description: `Auto-created from event: ${event.description || event.title}`,
              priority: event.severity === 'critical' ? 'critical' : event.severity === 'high' ? 'high' : 'medium',
              site_id: event.site_id, event_ids: [eventId],
            };
            await apiClient.edgeFunction('incidents-api', undefined, { method: 'POST', body: JSON.stringify(incidentData) });
            toast.success(t('events.create_incident') + ' ✓');
          }
          break;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally { setActionLoading(null); }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title="Events & Alarms"
      description="Real-time event monitoring and alarm management"
      icon={<AlertTriangle className="h-5 w-5" />}
      badge={<Badge variant="destructive" className="text-xs">{totalCount} new</Badge>}
    >
    <div className="flex flex-col lg:flex-row h-full">
      <div className={cn("flex-1 flex flex-col", selectedEvent && "lg:max-w-[60%] hidden lg:flex")}>
        <EventFiltersBar filters={filters} onChange={updateFilters} onReset={resetFilters} devices={devices} sites={sites} newCount={totalCount} />

        {/* Sound toggle + Bulk actions bar */}
        <div className="px-4 py-1.5 border-b flex items-center gap-2">
          <Button
            variant={isMuted ? 'outline' : 'default'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={toggleMute}
            aria-label={isMuted ? 'Enable sound alerts' : 'Mute sound alerts'}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {isMuted ? 'Sound Off' : 'Sound On'}
          </Button>

          {selectedIds.size > 0 && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>

              {bulkLoading ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing {bulkLoading.done}/{bulkLoading.total}...
                </div>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleBulkAction('acknowledge')}>
                    Acknowledge Selected
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleBulkAction('resolve')}>
                    Resolve Selected
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleBulkAction('dismiss')}>
                    Dismiss Selected
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4"><SkeletonTable rows={8} /></div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-12 w-12" />}
              title={t('events.no_events') || "No hay eventos"}
              description="Los eventos aparecerán aquí cuando se detecten"
            />
          ) : (
            <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-2 p-3">
              {events.map(event => {
                const sev = severityConfig[event.severity] || severityConfig.info;
                const device = devices.find(d => d.id === event.device_id);
                return (
                  <div
                    key={event.id}
                    className={cn("bg-card rounded-lg p-3 border cursor-pointer transition-colors hover:bg-muted/50", selected === event.id && "ring-1 ring-primary")}
                    onClick={() => setSelected(event.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={sev.color}>{sev.icon}</span>
                        <Badge variant={event.status === 'new' ? 'destructive' : event.status === 'resolved' ? 'secondary' : 'outline'} className="text-[10px] capitalize">{event.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-medium mt-1.5">{event.title}</p>
                    <p className="text-xs text-muted-foreground truncate capitalize">{(event.event_type || 'unknown').replace(/_/g, ' ')}{device ? ` — ${device.name}` : ''}</p>
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block">
            <Table aria-label="Events list">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 px-2">
                    <Checkbox
                      checked={events.length > 0 && events.every(e => selectedIds.has(e.id))}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t('events.event')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('events.device')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('events.site')}</TableHead>
                  <TableHead>{t('events.time')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(event => {
                  const sev = severityConfig[event.severity] || severityConfig.info;
                  const device = devices.find(d => d.id === event.device_id);
                  const site = sites.find(s => s.id === event.site_id);
                  return (
                    <TableRow key={event.id} className={cn("cursor-pointer", selected === event.id && "bg-muted/50", selectedIds.has(event.id) && "bg-primary/5")} onClick={() => setSelected(event.id)}>
                      <TableCell className="px-2" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(event.id)}
                          onCheckedChange={() => toggleSelect(event.id)}
                          aria-label={`Select ${event.title}`}
                        />
                      </TableCell>
                      <TableCell><span className={sev.color}>{sev.icon}</span></TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{(event.event_type || 'unknown').replace(/_/g, ' ')}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">{device?.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{site?.name?.split('—')[0]?.trim()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={event.status === 'new' ? 'destructive' : event.status === 'resolved' ? 'secondary' : 'outline'} className="text-[10px] capitalize">{event.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()} aria-label="Event actions"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAction(event.id, 'acknowledge')} disabled={event.status !== 'new'}>
                              <CheckCircle2 className="mr-2 h-3 w-3" /> {t('events.acknowledge')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAction(event.id, 'resolve')}>
                              <CheckCircle2 className="mr-2 h-3 w-3" /> {t('events.resolve')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAction(event.id, 'ai-summary')}>
                              <Bot className="mr-2 h-3 w-3" /> {t('events.ai_summary')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAction(event.id, 'create-incident')}>
                              <AlertTriangle className="mr-2 h-3 w-3" /> {t('events.create_incident')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </div>
        <div className="px-4 py-2 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {totalCount} {t('events.count')} · {t('events.page')} {filters.page} {t('events.of')} {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={(filters.page ?? 1) <= 1} onClick={() => updateFilters({ page: (filters.page ?? 1) - 1 })} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const current = filters.page ?? 1;
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (current <= 3) pageNum = i + 1;
              else if (current >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = current - 2 + i;
              return (
                <Button key={pageNum} variant={pageNum === current ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs" onClick={() => updateFilters({ page: pageNum })}>{pageNum}</Button>
              );
            })}
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={(filters.page ?? 1) >= totalPages} onClick={() => updateFilters({ page: (filters.page ?? 1) + 1 })} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
      {selectedEvent && (
        <div className="fixed inset-0 z-40 bg-background lg:static lg:z-auto lg:flex-1 overflow-auto">
          <button onClick={() => setSelected(null)} className="lg:hidden text-xs text-muted-foreground p-4 pb-0 flex items-center gap-1 hover:text-foreground">&larr; {t('common.back') || 'Back'}</button>
          <EventDetailPanel event={selectedEvent} devices={devices} sites={sites} actionLoading={actionLoading} onAction={handleAction} />
        </div>
      )}
    </div>
    </PageShell>
  );
}
