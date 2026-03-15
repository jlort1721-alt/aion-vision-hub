import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEvents, useDevices, useSites, type EventFilters } from '@/hooks/use-supabase-data';
import { useRealtimeEvents } from '@/hooks/use-realtime-events';
import { eventsApi, incidentsApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import {
  XCircle, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Bot, MoreHorizontal, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import EventFiltersBar from '@/components/events/EventFiltersBar';
import EventDetailPanel from '@/components/events/EventDetailPanel';

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

  const { data: result, isLoading } = useEvents(filters);
  const events = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: devices = [] } = useDevices();
  const { data: sites = [] } = useSites();
  const queryClient = useQueryClient();
  useRealtimeEvents();

  const updateFilters = useCallback((partial: Partial<EventFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
  }, []);
  const resetFilters = useCallback(() => setFilters(defaultFilters), []);
  const selectedEvent = selected ? events.find(e => e.id === selected) : null;

  const handleAction = async (eventId: string, action: string) => {
    setActionLoading(action);
    try {
      switch (action) {
        case 'acknowledge': await eventsApi.acknowledge(eventId); toast.success(t('events.acknowledged')); break;
        case 'resolve': await eventsApi.resolve(eventId); toast.success(t('events.resolved')); break;
        case 'dismiss': await eventsApi.dismiss(eventId); toast.success(t('events.dismissed')); break;
        case 'ai-summary': await eventsApi.aiSummary(eventId); toast.success(t('events.ai_summary')); break;
        case 'create-incident': {
          const event = events.find(e => e.id === eventId);
          if (event) {
            await incidentsApi.create({
              title: `Incident: ${event.title}`, description: `Auto-created from event: ${event.description || event.title}`,
              priority: event.severity === 'critical' ? 'critical' : event.severity === 'high' ? 'high' : 'medium',
              site_id: event.site_id, event_ids: [eventId],
            });
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className={cn("flex-1 flex flex-col", selectedEvent && "max-w-[60%]")}>
        <EventFiltersBar filters={filters} onChange={updateFilters} onReset={resetFilters} devices={devices} sites={sites} newCount={totalCount} />
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">{t('events.no_match')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t('events.event')}</TableHead>
                  <TableHead>{t('events.device')}</TableHead>
                  <TableHead>{t('events.site')}</TableHead>
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
                    <TableRow key={event.id} className={cn("cursor-pointer", selected === event.id && "bg-muted/50")} onClick={() => setSelected(event.id)}>
                      <TableCell><span className={sev.color}>{sev.icon}</span></TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{event.event_type.replace(/_/g, ' ')}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{device?.name}</TableCell>
                      <TableCell className="text-xs">{site?.name?.split('—')[0]?.trim()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={event.status === 'new' ? 'destructive' : event.status === 'resolved' ? 'secondary' : 'outline'} className="text-[10px] capitalize">{event.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
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
          )}
        </div>
        <div className="px-4 py-2 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {totalCount} {t('events.count')} · {t('events.page')} {filters.page} {t('events.of')} {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={(filters.page ?? 1) <= 1} onClick={() => updateFilters({ page: (filters.page ?? 1) - 1 })}><ChevronLeft className="h-4 w-4" /></Button>
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
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={(filters.page ?? 1) >= totalPages} onClick={() => updateFilters({ page: (filters.page ?? 1) + 1 })}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
      {selectedEvent && <EventDetailPanel event={selectedEvent} devices={devices} sites={sites} actionLoading={actionLoading} onAction={handleAction} />}
    </div>
  );
}
