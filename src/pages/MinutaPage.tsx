import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Plus, Clock, Filter, Printer, Download, Edit, Trash2,
  CheckCircle, AlertTriangle, Search, Bot, Copy, Loader2,
} from 'lucide-react';
import { sanitizeText } from '@/lib/sanitize';

// ── Entry types with colors ─────────────────────────────
const ENTRY_TYPES = [
  { value: 'novedad', label: 'Novedad', color: 'bg-primary/20 text-primary border-primary/30' },
  { value: 'ingreso', label: 'Ingreso', color: 'bg-success/20 text-success border-success/30' },
  { value: 'salida', label: 'Salida', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'ronda', label: 'Ronda', color: 'bg-info/20 text-info border-info/30' },
  { value: 'incidente', label: 'Incidente', color: 'bg-destructive/20 text-destructive border-destructive/30' },
  { value: 'llamada', label: 'Llamada', color: 'bg-info/20 text-info border-info/30' },
  { value: 'mantenimiento', label: 'Mantenimiento', color: 'bg-warning/20 text-warning border-warning/30' },
  { value: 'observacion', label: 'Observación', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
];

const PRIORITIES = [
  { value: 'normal', label: 'Normal', variant: 'secondary' as const },
  { value: 'importante', label: 'Importante', variant: 'default' as const },
  { value: 'urgente', label: 'Urgente', variant: 'destructive' as const },
];

interface MinutaEntry {
  id: string;
  tenant_id: string;
  shift_date: string;
  entry_time: string;
  entry_type: string;
  description: string;
  priority: string;
  author_id: string;
  author_name: string;
  is_closed: boolean;
  created_at: string;
}

function currentTime() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function shiftStart() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return '06:00';
  if (h >= 14 && h < 22) return '14:00';
  return '22:00';
}

function shiftLabel() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 'Turno Diurno (06:00 - 14:00)';
  if (h >= 14 && h < 22) return 'Turno Tarde (14:00 - 22:00)';
  return 'Turno Nocturno (22:00 - 06:00)';
}

function shiftDuration() {
  const now = new Date();
  const start = shiftStart().split(':');
  const startDate = new Date(now);
  startDate.setHours(parseInt(start[0]), parseInt(start[1]), 0, 0);
  if (now < startDate) startDate.setDate(startDate.getDate() - 1);
  const diff = Math.floor((now.getTime() - startDate.getTime()) / 60000);
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hrs}h ${mins}m`;
}

export default function MinutaPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [entryTime, setEntryTime] = useState(currentTime());
  const [entryType, setEntryType] = useState('novedad');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');

  // AI Summary
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState('');

  const aiSummaryMutation = useMutation({
    mutationFn: async () => {
      const result = await apiClient.get<{ success: boolean; data: { summary: string } }>('/ai/shift-summary');
      return result.data?.summary || result.data || 'No summary generated';
    },
    onSuccess: (text) => {
      setAiSummaryText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
      setShowAiSummary(true);
    },
    onError: (err: Error) => toast({ title: 'Error generating AI summary', description: err.message, variant: 'destructive' }),
  });

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchText, setSearchText] = useState('');

  // Edit/delete dialogs
  const [editEntry, setEditEntry] = useState<MinutaEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<MinutaEntry | null>(null);
  const [editForm, setEditForm] = useState({ entry_time: '', entry_type: '', description: '', priority: '' });

  const today = todayDate();

  // ── Query entries ─────────────────────────────
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['minuta_entries', profile?.tenant_id, today],
    queryFn: async () => {
      const response = await apiClient.get<any>('/database-records', { category: 'minuta', shift_date: today });
      return (Array.isArray(response.data) ? response.data : []) as unknown as MinutaEntry[];
    },
    enabled: !!profile?.tenant_id,
  });

  // ── Create entry ─────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!description.trim()) throw new Error('La descripcion es obligatoria');
      const payload = {
        tenant_id: profile?.tenant_id,
        shift_date: today,
        entry_time: entryTime,
        entry_type: entryType,
        description: description.trim(),
        priority,
        author_id: profile?.user_id,
        author_name: profile?.full_name || 'Operador',
        is_closed: false,
      };
      await apiClient.post('/database-records', { ...payload, category: 'minuta' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minuta_entries'] });
      setDescription('');
      setEntryTime(currentTime());
      setEntryType('novedad');
      setPriority('normal');
      toast({ title: 'Registro creado exitosamente' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Update entry ─────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editEntry) return;
      await apiClient.patch(`/database-records/${editEntry.id}`, {
        entry_time: editForm.entry_time,
        entry_type: editForm.entry_type,
        description: editForm.description.trim(),
        priority: editForm.priority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minuta_entries'] });
      setEditEntry(null);
      toast({ title: 'Registro actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Delete entry ─────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteEntry) return;
      await apiClient.delete(`/database-records/${deleteEntry.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minuta_entries'] });
      setDeleteEntry(null);
      toast({ title: 'Registro eliminado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Close shift ─────────────────────────────
  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch('/database-records/batch', {
        category: 'minuta',
        shift_date: today,
        update: { is_closed: true },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minuta_entries'] });
      toast({ title: 'Turno cerrado', description: 'La minuta ha sido marcada como finalizada.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Filtered entries ─────────────────────────────
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterType !== 'all' && e.entry_type !== filterType) return false;
      if (filterPriority !== 'all' && e.priority !== filterPriority) return false;
      if (searchText && !e.description.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterType, filterPriority, searchText]);

  // ── Summary stats ─────────────────────────────
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ENTRY_TYPES.forEach((t) => (counts[t.value] = 0));
    entries.forEach((e) => { counts[e.entry_type] = (counts[e.entry_type] || 0) + 1; });
    return counts;
  }, [entries]);

  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const isClosed = entries.length > 0 && entries[0]?.is_closed;

  const typeClass = (val: string) => ENTRY_TYPES.find((t) => t.value === val)?.color || '';
  const typeLabel = (val: string) => ENTRY_TYPES.find((t) => t.value === val)?.label || val;
  const priorityVariant = (val: string) => PRIORITIES.find((p) => p.value === val)?.variant || ('secondary' as const);
  const priorityLabel = (val: string) => PRIORITIES.find((p) => p.value === val)?.label || val;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ────────────────────── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Minuta de Turno
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {shiftLabel()} &middot; Operador: {profile?.full_name || 'Sin asignar'} &middot; Fecha: {new Date().toLocaleDateString('es-CO')}
          </p>
        </div>
        {isClosed && (
          <Badge variant="outline" className="border-success/50 text-success gap-1 self-start">
            <CheckCircle className="h-3 w-3" /> Turno Cerrado
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── New Entry Form ────────────────────── */}
          {!isClosed && (
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Nuevo Registro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Hora</Label>
                    <Input
                      type="time"
                      value={entryTime}
                      onChange={(e) => setEntryTime(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={entryType} onValueChange={setEntryType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ENTRY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Prioridad</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Descripcion</Label>
                  <Textarea
                    placeholder="Describa la novedad, evento o situacion..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !description.trim()}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Registrar
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Filters ────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {ENTRY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Prioridad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en descripciones..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* ── Entries List ────────────────────── */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No hay registros para mostrar</p>
                <p className="text-xs mt-1">Los registros del turno apareceran aqui</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => (
                <Card key={entry.id} className="border-border/50 bg-card/60 hover:bg-card/80 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {entry.entry_time}
                          </span>
                          <Badge variant="outline" className={typeClass(entry.entry_type)}>
                            {typeLabel(entry.entry_type)}
                          </Badge>
                          <Badge variant={priorityVariant(entry.priority)}>
                            {entry.priority === 'urgente' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {priorityLabel(entry.priority)}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground">{sanitizeText(entry.description)}</p>
                        <p className="text-xs text-muted-foreground">Por: {entry.author_name}</p>
                      </div>
                      {!isClosed && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => {
                              setEditEntry(entry);
                              setEditForm({
                                entry_time: entry.entry_time,
                                entry_type: entry.entry_type,
                                description: entry.description,
                                priority: entry.priority,
                              });
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteEntry(entry)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar: Shift Summary ────────────────────── */}
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen del Turno</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold text-foreground">{entries.length}</p>
                  <p className="text-xs text-muted-foreground">Total Registros</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-2xl font-bold text-foreground">{shiftDuration()}</p>
                  <p className="text-xs text-muted-foreground">Duracion</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Por Tipo</p>
                {ENTRY_TYPES.map((t) => (
                  typeCounts[t.value] > 0 && (
                    <div key={t.value} className="flex items-center justify-between text-sm">
                      <Badge variant="outline" className={`${t.color} text-xs`}>{t.label}</Badge>
                      <span className="font-mono text-muted-foreground">{typeCounts[t.value]}</span>
                    </div>
                  )
                ))}
                {entries.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin registros aun</p>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  className="w-full gap-1"
                  onClick={() => aiSummaryMutation.mutate()}
                  disabled={aiSummaryMutation.isPending || entries.length === 0}
                >
                  {aiSummaryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  Resumen IA
                </Button>
                {!isClosed && (
                  <Button
                    variant="default"
                    className="w-full gap-1"
                    onClick={() => closeShiftMutation.mutate()}
                    disabled={closeShiftMutation.isPending || entries.length === 0}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Cerrar Turno
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full gap-1"
                  onClick={() => {
                    const printArea = document.createElement('div');
                    printArea.style.cssText = 'font-family:Arial,sans-serif;padding:20px';
                    printArea.innerHTML = `
                      <h1 style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px">Minuta Operacional</h1>
                      <p style="text-align:center;color:#666;margin-bottom:24px">Generada: ${new Date().toLocaleString('es-CO')}</p>
                      <table style="width:100%;border-collapse:collapse">
                        <thead><tr style="background:#f0f0f0">
                          <th style="border:1px solid #ddd;padding:8px;text-align:left">Hora</th>
                          <th style="border:1px solid #ddd;padding:8px;text-align:left">Tipo</th>
                          <th style="border:1px solid #ddd;padding:8px;text-align:left">Descripción</th>
                          <th style="border:1px solid #ddd;padding:8px;text-align:left">Registrado por</th>
                        </tr></thead>
                        <tbody>${(entries || []).map((e: MinutaEntry) => `
                          <tr>
                            <td style="border:1px solid #ddd;padding:8px">${new Date(e.created_at).toLocaleTimeString('es-CO')}</td>
                            <td style="border:1px solid #ddd;padding:8px">${esc(e.entry_type || '')}</td>
                            <td style="border:1px solid #ddd;padding:8px">${esc(e.description || '')}</td>
                            <td style="border:1px solid #ddd;padding:8px">${esc(e.author_name || '')}</td>
                          </tr>`).join('')}
                        </tbody>
                      </table>
                    `;
                    const w = window.open('', '_blank');
                    if (w) {
                      w.document.write(printArea.innerHTML);
                      w.document.close();
                      w.print();
                    }
                    toast({ title: 'PDF', description: 'Ventana de impresión abierta. Selecciona "Guardar como PDF".' });
                  }}
                >
                  <Download className="h-4 w-4" />
                  Exportar PDF
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-1"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Edit Dialog ────────────────────── */}
      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Hora</Label>
                <Input
                  type="time"
                  value={editForm.entry_time}
                  onChange={(e) => setEditForm((f) => ({ ...f, entry_time: e.target.value }))}
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={editForm.entry_type} onValueChange={(v) => setEditForm((f) => ({ ...f, entry_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prioridad</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Descripcion</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ────────────────────── */}
      <Dialog open={!!deleteEntry} onOpenChange={(o) => !o && setDeleteEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Registro</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta seguro de eliminar este registro? Esta accion no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Summary Dialog */}
      <Dialog open={showAiSummary} onOpenChange={setShowAiSummary}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Resumen generado por IA</DialogTitle></DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-sans">{aiSummaryText}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(aiSummaryText); toast({ title: 'Copied to clipboard' }); }}>
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
            <Button onClick={() => setShowAiSummary(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
