import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuditLogs } from '@/hooks/use-supabase-data';
import { useI18n } from '@/contexts/I18nContext';
import { ScrollText, Search, Download, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

export default function AuditPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [detailLog, setDetailLog] = useState<any>(null);
  const { data: logs = [], isLoading } = useAuditLogs();

  const actions = [...new Set(logs.map(l => l.action))].sort();
  const filtered = logs.filter(log => {
    if (search && !log.action.toLowerCase().includes(search.toLowerCase()) && !log.user_email?.includes(search)) return false;
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('audit.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => exportCSV(filtered, 'audit-log.csv')}>
          <Download className="mr-1 h-4 w-4" /> {t('audit.export_csv')}
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('audit.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder={t('audit.all_actions')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('audit.all_actions')}</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
            {t('audit.no_logs')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('audit.timestamp')}</TableHead>
                <TableHead>{t('audit.user')}</TableHead>
                <TableHead>{t('audit.action')}</TableHead>
                <TableHead>{t('audit.entity')}</TableHead>
                <TableHead>{t('audit.ip')}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{log.user_email}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{log.action}</Badge></TableCell>
                  <TableCell className="text-xs capitalize">{log.entity_type}{log.entity_id ? ` #${log.entity_id.slice(-6)}` : ''}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{log.ip_address || '—'}</TableCell>
                  <TableCell>
                    {(log.before_state || log.after_state) && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setDetailLog(log)}>
                        <Eye className="mr-1 h-3 w-3" /> {t('common.view')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <div className="text-xs text-muted-foreground">{filtered.length} {t('common.records')}</div>

      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('audit.change_details')}</DialogTitle></DialogHeader>
          {detailLog && (
            <div className="space-y-3">
              <div className="text-sm"><strong>{t('audit.action')}:</strong> {detailLog.action}</div>
              <div className="text-sm"><strong>{t('audit.entity')}:</strong> {detailLog.entity_type} {detailLog.entity_id}</div>
              {detailLog.before_state && (
                <div>
                  <p className="text-xs font-medium mb-1 text-muted-foreground">{t('audit.before')}</p>
                  <pre className="text-xs bg-muted p-2 rounded-md overflow-auto font-mono max-h-40">{JSON.stringify(detailLog.before_state, null, 2)}</pre>
                </div>
              )}
              {detailLog.after_state && (
                <div>
                  <p className="text-xs font-medium mb-1 text-muted-foreground">{t('audit.after')}</p>
                  <pre className="text-xs bg-muted p-2 rounded-md overflow-auto font-mono max-h-40">{JSON.stringify(detailLog.after_state, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
