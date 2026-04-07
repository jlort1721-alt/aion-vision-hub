import { useState } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/contexts/I18nContext';
import { useDevices } from '@/hooks/use-api-data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rebootsApi, aiApi } from '@/services/reboots-api';
import {
  RotateCcw, Search, AlertTriangle, CheckCircle, Clock,
  WifiOff, Bot, Zap, MoreHorizontal, Plus, Loader2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Procedimientos de referencia operativa (guía para operadores)
const REBOOT_PROCEDURES = [
  { id: 'proc-001', title: 'Reinicio remoto de cámara IP', steps: ['Verificar conectividad de red', 'Intentar ping al dispositivo', 'Enviar comando de reinicio ONVIF/ISAPI', 'Esperar 60 segundos', 'Verificar stream RTSP', 'Confirmar resolución o escalar'], difficulty: 'basico' },
  { id: 'proc-002', title: 'Reinicio de NVR', steps: ['Notificar al supervisor', 'Verificar que no hay grabaciones activas críticas', 'Enviar comando de reinicio', 'Esperar 2-3 minutos', 'Verificar canales reconectados', 'Confirmar grabación reanudada'], difficulty: 'intermedio' },
  { id: 'proc-003', title: 'Reinicio de switch/PoE', steps: ['Identificar dispositivos afectados', 'Notificar a central', 'Reiniciar puerto PoE específico', 'Si no resuelve, reiniciar switch completo', 'Esperar reconexión de todos los dispositivos', 'Verificar uno por uno'], difficulty: 'avanzado' },
  { id: 'proc-004', title: 'Verificación post-reinicio', steps: ['Confirmar IP accesible', 'Verificar stream de video', 'Verificar grabación local/NVR', 'Verificar eventos inteligentes', 'Registrar resultado en bitácora'], difficulty: 'basico' },
];

const difficultyLabels: Record<string, string> = {
  basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado',
  basic: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente', in_progress: 'En curso', completed: 'Completado', failed: 'Fallido',
};

export default function RebootsPage() {
  const { t } = useI18n();
  const { data: rawDevices = [] } = useDevices();
  const devices = rawDevices as any[];
  const queryClient = useQueryClient();
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ device_id: '', reason: '' });
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Fetch reboot tasks from backend API
  const { data: rebootTasks = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reboot_tasks'],
    queryFn: async () => {
      const resp = await rebootsApi.list();
      return resp.data;
    },
  });

  // Create reboot task via backend API
  const createMutation = useMutation({
    mutationFn: async (input: { deviceId?: string; reason: string }) => {
      const resp = await rebootsApi.create(input);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reboot_tasks'] });
      toast.success('Reinicio iniciado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Complete/fail reboot task via backend API
  const completeMutation = useMutation({
    mutationFn: async ({ id, status, result, recoveryTimeSeconds }: { id: string; status: 'completed' | 'failed'; result?: string; recoveryTimeSeconds?: number }) => {
      const resp = await rebootsApi.complete(id, { status, result, recoveryTimeSeconds });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reboot_tasks'] });
      toast.success('Estado de reinicio actualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const offlineDevices = devices.filter(d => d.status === 'offline' || d.status === 'degraded');
  const procedure = selectedProcedure ? REBOOT_PROCEDURES.find(p => p.id === selectedProcedure) : null;
  const successCount = rebootTasks.filter((t: any) => t.status === 'completed').length;
  const failedCount = rebootTasks.filter((t: any) => t.status === 'failed').length;

  const handleAdd = () => {
    if (!form.reason.trim()) return;
    createMutation.mutate({ deviceId: form.device_id || undefined, reason: form.reason });
    setAddOpen(false);
    setForm({ device_id: '', reason: '' });
  };

  const handleAiDiagnose = async () => {
    if (!procedure) return;
    setAiLoading('diagnose');
    setAiResult(null);
    try {
      const offlineInfo = offlineDevices.length > 0
        ? `\nDispositivos offline: ${offlineDevices.map(d => `${d.name} (${d.ip_address})`).join(', ')}`
        : '\nNo hay dispositivos offline actualmente.';
      const resp = await aiApi.chat([
        { role: 'system', content: 'Eres un experto en diagnostico de sistemas de videovigilancia y seguridad electronica. Responde en espanol, de forma concisa y tecnica.' },
        { role: 'user', content: `Diagnostica el siguiente escenario para el procedimiento "${procedure.title}":\nPasos del procedimiento: ${(procedure.steps || []).join(' -> ')}${offlineInfo}\n\nProporciona un diagnostico breve con posibles causas y estado estimado.` },
      ], { temperature: 0.4, maxTokens: 1024 });
      setAiResult(resp.data.content);
    } catch (err: any) {
      toast.error(err.message || 'AI diagnosis failed');
    } finally {
      setAiLoading(null);
    }
  };

  const handleAiSuggestFix = async () => {
    if (!procedure) return;
    setAiLoading('fix');
    setAiResult(null);
    try {
      const offlineInfo = offlineDevices.length > 0
        ? `\nDispositivos afectados: ${offlineDevices.map(d => `${d.name} (${d.ip_address}, ${d.brand || 'marca desconocida'})`).join(', ')}`
        : '\nNo hay dispositivos offline actualmente.';
      const resp = await aiApi.chat([
        { role: 'system', content: 'Eres un experto en resolucion de problemas de sistemas de videovigilancia y seguridad electronica. Responde en espanol con pasos concretos y accionables.' },
        { role: 'user', content: `Sugiere una solucion para el procedimiento "${procedure.title}" (nivel: ${procedure.difficulty}).${offlineInfo}\n\nProporciona pasos especificos para resolver el problema, incluyendo comandos o acciones concretas si aplica.` },
      ], { temperature: 0.4, maxTokens: 1024 });
      setAiResult(resp.data.content);
    } catch (err: any) {
      toast.error(err.message || 'AI suggestion failed');
    } finally {
      setAiLoading(null);
    }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2"><RotateCcw className="h-5 w-5 text-primary" /> {t('reboots.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('reboots.subtitle')}</p>
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('reboots.initiate')}</Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /><div><p className="text-xs text-muted-foreground">{t('reboots.devices_needing_attention')}</p><p className="text-lg font-bold">{offlineDevices.length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" /><div><p className="text-xs text-muted-foreground">{t('reboots.successful_today')}</p><p className="text-lg font-bold">{successCount}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><div><p className="text-xs text-muted-foreground">{t('reboots.failed')}</p><p className="text-lg font-bold">{failedCount}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{t('reboots.total_reboots')}</p><p className="text-lg font-bold">{rebootTasks.length}</p></div></div></Card>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Reboot tasks list */}
          <div className="flex-1 flex flex-col border-r">
            <div className="px-4 py-2 border-b space-y-2">
              <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por razón..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" /></div>
              <div className="flex items-center gap-1">
                {['all', 'pending', 'completed', 'failed'].map(s => (
                  <Button key={s} variant={taskStatusFilter === s ? 'default' : 'ghost'} size="sm" className="h-6 text-[10px] px-2" onClick={() => setTaskStatusFilter(s)}>
                    {s === 'all' ? 'Todos' : statusLabels[s] || s}
                    {s !== 'all' && <Badge variant="secondary" className="ml-1 h-4 text-[9px]">{rebootTasks.filter((t: any) => t.status === s).length}</Badge>}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : rebootTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <RotateCcw className="h-12 w-12 mb-2 opacity-20" />
                  <p className="text-sm">Sin tareas de reinicio</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('reboots.initiate')}</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>Razón</TableHead>
                      <TableHead>Recuperación</TableHead>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rebootTasks.filter((task: any) => {
                      if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false;
                      if (search && !(task.reason || '').toLowerCase().includes(search.toLowerCase())) return false;
                      return true;
                    }).map((task: any) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Badge variant={task.status === 'completed' ? 'default' : task.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">{statusLabels[task.status] || task.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{task.reason}</TableCell>
                        <TableCell className="text-xs font-mono">{task.recovery_time_seconds ? `${task.recovery_time_seconds}s` : task.recoveryTimeSeconds ? `${task.recoveryTimeSeconds}s` : '\u2014'}</TableCell>
                        <TableCell className="text-xs font-mono">{new Date(task.created_at ?? task.createdAt).toLocaleString('es-CO')}</TableCell>
                        <TableCell>
                          {task.status === 'pending' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => completeMutation.mutate({ id: task.id, status: 'completed', result: 'OK', recoveryTimeSeconds: 45 })}>
                                  <CheckCircle className="mr-2 h-3 w-3" /> Marcar Completado
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => completeMutation.mutate({ id: task.id, status: 'failed', result: 'Dispositivo inalcanzable' })}>
                                  <AlertTriangle className="mr-2 h-3 w-3" /> Marcar Fallido
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Offline devices */}
            {offlineDevices.length > 0 && (
              <div className="border-t p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t('reboots.devices_needing_attention')}</p>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {offlineDevices.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-1.5 rounded bg-muted/50">
                      <div className="flex items-center gap-2">
                        <WifiOff className="h-3 w-3 text-destructive" />
                        <span className="text-xs font-medium">{d.name}</span>
                        <span className="text-[10px] text-muted-foreground">{d.ip_address}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setForm({ device_id: d.id, reason: `${d.name} offline` }); setAddOpen(true); }}>
                        <RotateCcw className="mr-1 h-3 w-3" /> Reboot
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Procedures panel */}
          <div className="w-80 flex flex-col">
            <div className="px-3 py-2 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase">{t('reboots.procedures')}</p>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-2">
              {REBOOT_PROCEDURES.map(proc => (
                <Card key={proc.id} className={cn("cursor-pointer transition-colors", selectedProcedure === proc.id && "border-primary")} onClick={() => { setSelectedProcedure(proc.id); setAiResult(null); }}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-medium">{proc.title}</p>
                      <Badge variant="outline" className="text-[9px]">{difficultyLabels[proc.difficulty] || proc.difficulty}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{proc.steps.length} pasos</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {procedure && (
              <div className="border-t p-3 space-y-2">
                <p className="text-xs font-semibold">{procedure.title}</p>
                <div className="space-y-1.5">
                  {(procedure.steps || []).map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-primary">{i + 1}</span></div>
                      <p className="text-[11px] text-muted-foreground pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>

                {/* AI result area */}
                <div className="p-2 rounded bg-muted/50 border mt-2">
                  <div className="flex items-center gap-1 mb-1"><Bot className="h-3 w-3 text-primary" /><span className="text-[10px] font-semibold">Asistente IA</span></div>
                  {aiLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span className="text-[10px] text-muted-foreground">
                        {aiLoading === 'diagnose' ? 'Ejecutando diagnóstico...' : 'Generando sugerencia de solución...'}
                      </span>
                    </div>
                  ) : aiResult ? (
                    <p className="text-[10px] text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">{aiResult}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      {procedure.difficulty === 'basico' || procedure.difficulty === 'basic'
                        ? `Procedimiento básico. Siga los ${procedure.steps.length} pasos secuencialmente para "${procedure.title}".`
                        : procedure.difficulty === 'intermedio' || procedure.difficulty === 'intermediate'
                        ? `Procedimiento intermedio. Notifique al supervisor antes de ejecutar "${procedure.title}".`
                        : `Procedimiento avanzado: "${procedure.title}" puede afectar múltiples dispositivos. Coordine con central antes de proceder.`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] flex-1"
                    disabled={!!aiLoading}
                    onClick={handleAiDiagnose}
                  >
                    {aiLoading === 'diagnose' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />} Diagnosticar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] flex-1"
                    disabled={!!aiLoading}
                    onClick={handleAiSuggestFix}
                  >
                    {aiLoading === 'fix' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Bot className="mr-1 h-3 w-3" />} Sugerir Solución
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('reboots.initiate')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Dispositivo</Label>
              <Select value={form.device_id} onValueChange={v => setForm(p => ({ ...p, device_id: v }))}><SelectTrigger><SelectValue placeholder="Seleccionar dispositivo" /></SelectTrigger>
                <SelectContent>{devices.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.ip_address})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Razón *</Label><Textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Describa el problema..." /></div>
            <Button className="w-full" onClick={handleAdd} disabled={!form.reason.trim() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />} Iniciar Reinicio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
