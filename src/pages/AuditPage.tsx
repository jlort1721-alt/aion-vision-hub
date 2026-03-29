import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auditApi } from '@/services/audit-api';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ScrollText, Search, Download, ChevronDown, ChevronRight,
  ChevronLeft, CalendarIcon, RefreshCw, Users, Activity, LayoutGrid,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  created_at: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
}

interface AuditFilters {
  search: string;
  action: string;
  entityType: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  user: string;
  page: number;
}

// ── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 25;

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
];

const ENTITY_TYPES = [
  { value: 'all', label: 'All Entities' },
  { value: 'device', label: 'Device' },
  { value: 'event', label: 'Event' },
  { value: 'incident', label: 'Incident' },
  { value: 'site', label: 'Site' },
  { value: 'user', label: 'User' },
];

const ACTION_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  login: 'outline',
  logout: 'outline',
};

// ── CSV Export ────────────────────────────────────────────────

function exportCSV(data: AuditLog[], filename: string) {
  if (!data.length) {
    toast.error('No data to export');
    return;
  }
  const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address'];
  const rows = data.map(row => [
    new Date(row.created_at).toISOString(),
    row.user_email || '',
    row.action || '',
    row.entity_type || '',
    row.entity_id || '',
    row.ip_address || '',
  ]);
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exported successfully');
}

// ── Component ────────────────────────────────────────────────

const defaultFilters: AuditFilters = {
  search: '',
  action: 'all',
  entityType: 'all',
  dateFrom: undefined,
  dateTo: undefined,
  user: 'all',
  page: 1,
};

export default function AuditPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data Fetching ──────────────────────────────────────────

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = {
      page: filters.page,
      pageSize: PAGE_SIZE,
    };
    if (filters.search) params.search = filters.search;
    if (filters.action !== 'all') params.action = filters.action;
    if (filters.entityType !== 'all') params.entity_type = filters.entityType;
    if (filters.user !== 'all') params.user_email = filters.user;
    if (filters.dateFrom) params.date_from = filters.dateFrom.toISOString();
    if (filters.dateTo) params.date_to = filters.dateTo.toISOString();
    return params;
  }, [filters]);

  const { data: response, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => auditApi.list(queryParams),
    enabled: isAuthenticated,
    staleTime: 10_000,
  });

  const logs: AuditLog[] = useMemo(() => response?.data ?? [], [response?.data]);
  const meta = response?.meta ?? {};
  const totalCount = meta.total ?? logs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Auto-refresh ───────────────────────────────────────────

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      }, 30_000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, queryClient]);

  // ── Computed stats ─────────────────────────────────────────

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = logs.filter(l => new Date(l.created_at) >= today);
    const uniqueUsers = new Set(logs.map(l => l.user_email).filter(Boolean));
    const moduleCounts: Record<string, number> = {};
    logs.forEach(l => {
      if (l.entity_type) {
        moduleCounts[l.entity_type] = (moduleCounts[l.entity_type] || 0) + 1;
      }
    });
    const mostActive = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      actionsToday: todayLogs.length,
      uniqueUsers: uniqueUsers.size,
      mostActiveModule: mostActive ? mostActive[0] : 'N/A',
    };
  }, [logs]);

  // ── Unique users for dropdown ──────────────────────────────

  const uniqueUserEmails = useMemo(() => {
    return [...new Set(logs.map(l => l.user_email).filter(Boolean))].sort();
  }, [logs]);

  // ── Handlers ───────────────────────────────────────────────

  const updateFilters = useCallback((partial: Partial<AuditFilters>) => {
    setFilters(prev => ({ ...prev, ...partial, page: partial.page ?? 1 }));
  }, []);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleManualRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    toast.success('Audit logs refreshed');
  }, [queryClient]);

  // ── Render ─────────────────────────────────────────────────

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('audit.title') || 'Audit Log'}</h1>
          <p className="text-sm text-muted-foreground">
            {t('audit.subtitle') || 'Track all user actions and system changes'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              aria-label="Auto-refresh"
            />
            <span className="text-muted-foreground text-xs">
              Auto-refresh {autoRefresh ? '(30s)' : 'off'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isFetching}>
            <RefreshCw className={cn('mr-1 h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(logs, `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`)}>
            <Download className="mr-1 h-4 w-4" />
            {t('audit.export_csv') || 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <p className="text-2xl font-bold">{stats.actionsToday}</p>
              )}
              <p className="text-xs text-muted-foreground">Actions Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
              )}
              <p className="text-xs text-muted-foreground">Unique Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            {isLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <LayoutGrid className="h-5 w-5 text-amber-500" />
              </div>
            )}
            <div>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <p className="text-2xl font-bold capitalize">{stats.mostActiveModule}</p>
              )}
              <p className="text-xs text-muted-foreground">Most Active Module</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, entity..."
            value={filters.search}
            onChange={e => updateFilters({ search: e.target.value })}
            className="pl-8 h-9"
          />
        </div>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-9 text-xs gap-1', !filters.dateFrom && 'text-muted-foreground')}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {filters.dateFrom ? format(filters.dateFrom, 'MMM dd, yyyy') : 'From date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => updateFilters({ dateFrom: date ?? undefined })}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('h-9 text-xs gap-1', !filters.dateTo && 'text-muted-foreground')}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {filters.dateTo ? format(filters.dateTo, 'MMM dd, yyyy') : 'To date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => updateFilters({ dateTo: date ?? undefined })}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* User Dropdown */}
        <Select value={filters.user} onValueChange={v => updateFilters({ user: v })}>
          <SelectTrigger className="w-44 h-9 text-xs">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {uniqueUserEmails.map(email => (
              <SelectItem key={email} value={email}>{email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action Type */}
        <Select value={filters.action} onValueChange={v => updateFilters({ action: v })}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map(a => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Entity Type */}
        <Select value={filters.entityType} onValueChange={v => updateFilters({ entityType: v })}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map(e => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset */}
        {(filters.search || filters.action !== 'all' || filters.entityType !== 'all' || filters.user !== 'all' || filters.dateFrom || filters.dateTo) && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setFilters(defaultFilters)}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No audit logs found</p>
            <p className="text-xs mt-1">Try adjusting your filters or check back later</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => {
                const hasChanges = !!(log.before_state || log.after_state);
                const isExpanded = expandedRows.has(log.id);
                return (
                  <Collapsible key={log.id} open={isExpanded} onOpenChange={() => hasChanges && toggleRow(log.id)} asChild>
                    <React.Fragment>
                      <CollapsibleTrigger asChild disabled={!hasChanges}>
                        <TableRow className={cn('cursor-pointer hover:bg-muted/50', isExpanded && 'bg-muted/30', !hasChanges && 'cursor-default')}>
                          <TableCell className="w-8 text-center">
                            {hasChanges ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">{log.user_email || '---'}</TableCell>
                          <TableCell>
                            <Badge variant={ACTION_BADGE_VARIANT[log.action] ?? 'outline'} className="text-[10px] capitalize">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs capitalize">{log.entity_type || '---'}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {log.entity_id ? `#${log.entity_id.length > 8 ? log.entity_id.slice(-8) : log.entity_id}` : '---'}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {log.ip_address || '---'}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={7} className="p-0">
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {log.before_state && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Before</p>
                                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto font-mono max-h-48 border">
                                    {JSON.stringify(log.before_state, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.after_state && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">After</p>
                                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto font-mono max-h-48 border">
                                    {JSON.stringify(log.after_state, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </React.Fragment>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {!isLoading && logs.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {totalCount} records {'\u00B7'} Page {filters.page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={filters.page <= 1}
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
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
                  onClick={() => setFilters(prev => ({ ...prev, page: pageNum }))}
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
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
