import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIncidents, useSites } from '@/hooks/use-supabase-data';
import { incidentsApi } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import {
  AlertTriangle, Plus, Search, MessageSquare, Bot,
  Clock, User, CheckCircle2, Loader2, XCircle, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/lib/sanitize';
import EvidencePanel from '@/components/incidents/EvidencePanel';

const priorityColors: Record<string, string> = {
  critical: 'text-destructive', high: 'text-warning', medium: 'text-info', low: 'text-muted-foreground',
};

export default function IncidentsPage() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newIncident, setNewIncident] = useState({ title: '', description: '', priority: 'medium', site_id: '' });

  const { data: incidents = [], isLoading } = useIncidents();
  const { data: sites = [] } = useSites();
  const queryClient = useQueryClient();

  const filtered = incidents.filter(i => !searchTerm || i.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const selectedInc = selected ? incidents.find(i => i.id === selected) : null;

  React.useEffect(() => {
    if (!selected && incidents.length > 0) setSelected(incidents[0].id);
  }, [incidents, selected]);

  const handleCreate = async () => {
    if (!newIncident.title.trim()) { toast.error(t('incidents.title_label') + ' required'); return; }
    setActionLoading('create');
    try {
      await incidentsApi.create({ title: newIncident.title, description: newIncident.description, priority: newIncident.priority, site_id: newIncident.site_id || null });
      toast.success(t('incidents.create_incident') + ' ✓');
      setCreateOpen(false);
      setNewIncident({ title: '', description: '', priority: 'medium', site_id: '' });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setActionLoading(null); }
  };

  const handleComment = async () => {
    if (!selectedInc || !comment.trim()) return;
    setActionLoading('comment');
    try {
      await incidentsApi.addComment(selectedInc.id, comment);
      toast.success(t('incidents.comment') + ' ✓');
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setActionLoading(null); }
  };

  const handleClose = async () => {
    if (!selectedInc) return;
    setActionLoading('close');
    try {
      await incidentsApi.close(selectedInc.id);
      toast.success(t('incidents.closed'));
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setActionLoading(null); }
  };

  const handleAiSummary = async () => {
    if (!selectedInc) return;
    setActionLoading('ai');
    try {
      await incidentsApi.aiSummary(selectedInc.id);
      toast.success(t('incidents.ai_summary') + ' ✓');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setActionLoading(null); }
  };

  const handleResolve = async () => {
    if (!selectedInc) return;
    setActionLoading('resolve');
    try {
      await incidentsApi.update(selectedInc.id, { status: 'resolved' });
      toast.success(t('incidents.resolve') + ' ✓');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setActionLoading(null); }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)]">
      <div className={cn("w-full md:w-80 border-r flex flex-col", selected && "hidden md:flex")}>
        <div className="px-3 py-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold">{t('incidents.title')}</h1>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" /> {t('common.new')}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t('incidents.create_incident')}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>{t('incidents.title_label')}</Label>
                    <Input value={newIncident.title} onChange={e => setNewIncident(p => ({ ...p, title: e.target.value }))} placeholder={t('incidents.title_label')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('incidents.description_label')}</Label>
                    <Textarea value={newIncident.description} onChange={e => setNewIncident(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('incidents.priority')}</Label>
                      <Select value={newIncident.priority} onValueChange={v => setNewIncident(p => ({ ...p, priority: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">{t('events.critical')}</SelectItem>
                          <SelectItem value="high">{t('events.high')}</SelectItem>
                          <SelectItem value="medium">{t('events.medium')}</SelectItem>
                          <SelectItem value="low">{t('events.low')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('events.site')}</Label>
                      <Select value={newIncident.site_id} onValueChange={v => setNewIncident(p => ({ ...p, site_id: v }))}>
                        <SelectTrigger><SelectValue placeholder={t('events.site')} /></SelectTrigger>
                        <SelectContent>
                          {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleCreate} disabled={actionLoading === 'create'}>
                    {actionLoading === 'create' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                    {t('incidents.create_incident')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input placeholder={t('incidents.search')} className="pl-7 h-7 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-3 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('incidents.no_incidents')}</div>
          ) : filtered.map(inc => (
            <button key={inc.id} className={cn("w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors", selected === inc.id && "bg-muted/50")} onClick={() => setSelected(inc.id)}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", priorityColors[inc.priority] || 'text-muted-foreground')} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{inc.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[9px] capitalize">{inc.status}</Badge>
                    <Badge variant="outline" className="text-[9px] capitalize">{inc.priority}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(inc.created_at).toLocaleString()}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedInc ? (
        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
          <button onClick={() => setSelected(null)} className="md:hidden text-xs text-muted-foreground mb-2 flex items-center gap-1 hover:text-foreground">&larr; {t('common.back') || 'Back'}</button>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="capitalize">{selectedInc.status}</Badge>
                <Badge className={cn("capitalize text-xs", selectedInc.priority === 'critical' ? 'bg-destructive' : '')}>{selectedInc.priority}</Badge>
              </div>
              <h2 className="text-xl font-bold">{selectedInc.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{sanitizeText(selectedInc.description)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleAiSummary} disabled={!!actionLoading}>
                {actionLoading === 'ai' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Bot className="mr-1 h-3 w-3" />} {t('incidents.ai_summary')}
              </Button>
              {selectedInc.status !== 'closed' && selectedInc.status !== 'resolved' && (
                <>
                  <Button variant="secondary" size="sm" onClick={handleResolve} disabled={!!actionLoading}>
                    {actionLoading === 'resolve' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />} {t('incidents.resolve')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleClose} disabled={!!actionLoading}>
                    {actionLoading === 'close' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />} {t('incidents.close')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {selectedInc.ai_summary && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Bot className="h-3 w-3" /> {t('incidents.ai_summary')}</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{selectedInc.ai_summary}</p></CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-3 space-y-1 text-sm"><p className="text-xs text-muted-foreground">{t('incidents.assigned_to')}</p><p className="font-medium flex items-center gap-1"><User className="h-3 w-3" /> {selectedInc.assigned_to ? 'Operator' : t('incidents.unassigned')}</p></CardContent></Card>
            <Card><CardContent className="p-3 space-y-1 text-sm"><p className="text-xs text-muted-foreground">{t('incidents.related_events')}</p><p className="font-medium">{selectedInc.event_ids?.length || 0} {t('events.count')}</p></CardContent></Card>
            <Card><CardContent className="p-3 space-y-1 text-sm"><p className="text-xs text-muted-foreground">{t('incidents.created')}</p><p className="font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(selectedInc.created_at).toLocaleString()}</p></CardContent></Card>
          </div>

          <Tabs defaultValue="activity" className="w-full">
            <TabsList>
              <TabsTrigger value="activity" className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> {t('incidents.activity')}
              </TabsTrigger>
              <TabsTrigger value="evidence" className="flex items-center gap-1">
                <Shield className="h-3 w-3" /> Evidence
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <Card>
                <CardContent className="space-y-3 pt-4">
                  {Array.isArray(selectedInc.comments) && (selectedInc.comments as any[]).map((c: any, idx: number) => (
                    <div key={c.id || idx} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold shrink-0">
                        {(c.user_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.user_name || 'User'}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{sanitizeText(c.content)}</p>
                      </div>
                    </div>
                  ))}
                  {selectedInc.status !== 'closed' && (
                    <>
                      <Textarea placeholder={t('incidents.add_comment')} className="text-sm min-h-[60px]" value={comment} onChange={e => setComment(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleComment} disabled={!comment.trim() || actionLoading === 'comment'}>
                          {actionLoading === 'comment' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <MessageSquare className="mr-1 h-3 w-3" />} {t('incidents.comment')}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidence">
              <EvidencePanel incidentId={selectedInc.id} incidentStatus={selectedInc.status} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>{t('incidents.select_incident')}</p>
        </div>
      )}
    </div>
  );
}
