import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ErrorState from '@/components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { KeyRound, Plus, ArrowRightLeft, History, Search, MoreHorizontal, Pencil, Trash2, RotateCcw, AlertTriangle, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { keysApi, keyLogsApi } from '@/services/keys-api';
import { PageShell } from '@/components/shared/PageShell';

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const statusConfig: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponible', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  assigned: { label: 'Asignada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  lost: { label: 'Perdida', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  retired: { label: 'Retirada', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
};

const actionConfig: Record<string, { label: string; color: string }> = {
  assigned: { label: 'Asignada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  returned: { label: 'Devuelta', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  reported_lost: { label: 'Reportada perdida', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  transferred: { label: 'Transferida', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  retired: { label: 'Retirada', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  created: { label: 'Creada', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
};

const typeLabels: Record<string, string> = {
  master: 'Maestra', access: 'Acceso', cabinet: 'Gabinete', vehicle: 'Vehículo', other: 'Otra',
};

const defaultKeyForm = { keyCode: '', label: '', description: '', keyType: 'access', location: '', copies: 1, notes: '' };

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

export default function KeysPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('inventory');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Dialogs
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnTarget, setReturnTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Forms
  const [keyForm, setKeyForm] = useState({ ...defaultKeyForm });
  const [assignHolder, setAssignHolder] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Queries
  const { data: keysResult, isLoading: loadingKeys, isError, error, refetch } = useQuery({
    queryKey: ['keys', statusFilter, typeFilter],
    queryFn: () => keysApi.list({ ...(statusFilter !== 'all' && { status: statusFilter }), ...(typeFilter !== 'all' && { keyType: typeFilter }) }),
  });
  const { data: logsResult, isLoading: loadingLogs } = useQuery({ queryKey: ['key-logs'], queryFn: () => keyLogsApi.list() });
  const { data: statsResult } = useQuery({ queryKey: ['key-stats'], queryFn: () => keysApi.getStats() });

  const keys: any[] = (keysResult as any)?.data ?? [];
  const logs: any[] = (logsResult as any)?.data ?? [];
  const s: any = (statsResult as any)?.data ?? statsResult;

  // Mutations
  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => keysApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); closeKeyDialog(); toast.success('Llave creada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => keysApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); closeKeyDialog(); toast.success('Llave actualizada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => keysApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); setDeleteTarget(null); toast.success('Llave eliminada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const assignMut = useMutation({
    mutationFn: ({ id, toHolder, notes }: { id: string; toHolder: string; notes?: string }) => keysApi.assign(id, { toHolder, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-logs'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); closeAssignDialog(); toast.success('Llave asignada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const returnMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => keysApi.returnKey(id, { notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-logs'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); closeReturnDialog(); toast.success('Llave devuelta'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const reportLostMut = useMutation({
    mutationFn: (id: string) => keysApi.update(id, { status: 'lost' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); toast.success('Llave reportada como perdida'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // Dialog helpers
  const openCreateKey = () => { setEditingKey(null); setKeyForm({ ...defaultKeyForm }); setShowKeyDialog(true); };
  const openEditKey = (k: any) => { setEditingKey(k); setKeyForm({ keyCode: k.keyCode || '', label: k.label || '', description: k.description || '', keyType: k.keyType || 'access', location: k.location || '', copies: k.copies || 1, notes: k.notes || '' }); setShowKeyDialog(true); };
  const closeKeyDialog = () => { setShowKeyDialog(false); setEditingKey(null); setKeyForm({ ...defaultKeyForm }); };
  const openAssignDialog = (k: any) => { setAssignTarget(k); setAssignHolder(''); setAssignNotes(''); setShowAssignDialog(true); };
  const closeAssignDialog = () => { setShowAssignDialog(false); setAssignTarget(null); };
  const openReturnDialog = (k: any) => { setReturnTarget(k); setReturnNotes(''); setShowReturnDialog(true); };
  const closeReturnDialog = () => { setShowReturnDialog(false); setReturnTarget(null); };

  const handleKeySubmit = () => { if (editingKey) updateMut.mutate({ id: editingKey.id, ...keyForm }); else createMut.mutate(keyForm); };

  // Filtering
  const filteredKeys = useMemo(() => {
    if (!search) return keys;
    const q = search.toLowerCase();
    return keys.filter((k: any) => k.keyCode?.toLowerCase().includes(q) || k.label?.toLowerCase().includes(q) || k.location?.toLowerCase().includes(q) || k.currentHolder?.toLowerCase().includes(q));
  }, [keys, search]);

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((l: any) => l.keyCode?.toLowerCase().includes(q) || l.fromHolder?.toLowerCase().includes(q) || l.toHolder?.toLowerCase().includes(q) || l.notes?.toLowerCase().includes(q));
  }, [logs, search]);

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title="Gestión de Llaves"
      description="Inventario, asignaciones y trazabilidad de llaves físicas"
      icon={<KeyRound className="h-5 w-5" />}
      actions={<Button size="sm" onClick={openCreateKey} className="gap-1.5"><Plus className="h-4 w-4" /> Nueva Llave</Button>}
    >
    <div className="p-5 space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<KeyRound className="h-5 w-5 text-blue-400" />} label="Total Llaves" value={s?.total ?? 0} color="text-blue-400" />
        <StatCard icon={<KeyRound className="h-5 w-5 text-emerald-400" />} label="Disponibles" value={s?.available ?? 0} color="text-emerald-400" />
        <StatCard icon={<ArrowRightLeft className="h-5 w-5 text-purple-400" />} label="Asignadas" value={s?.assigned ?? 0} color="text-purple-400" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-400" />} label="Perdidas" value={s?.lost ?? 0} color="text-red-400" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="inventory" className="gap-1 text-xs"><KeyRound className="h-3.5 w-3.5" /> Inventario</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1 text-xs"><History className="h-3.5 w-3.5" /> Historial</TabsTrigger>
          </TabsList>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input placeholder="Buscar llaves, responsables, ubicaciones..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-slate-900/50 border-slate-700" />
          </div>
          {tab === 'inventory' && (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="assigned">Asignada</SelectItem>
                  <SelectItem value="lost">Perdida</SelectItem>
                  <SelectItem value="retired">Retirada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="master">Maestra</SelectItem>
                  <SelectItem value="access">Acceso</SelectItem>
                  <SelectItem value="cabinet">Gabinete</SelectItem>
                  <SelectItem value="vehicle">Vehículo</SelectItem>
                  <SelectItem value="other">Otra</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* ═══ Inventory Tab ═══ */}
        <TabsContent value="inventory">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardContent className="p-0">
              {loadingKeys ? (
                <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredKeys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <KeyRound className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">{keys.length === 0 ? 'Sin llaves registradas' : 'Sin resultados'}</p>
                  {keys.length === 0 && <Button size="sm" variant="ghost" className="mt-2 gap-1" onClick={openCreateKey}><Plus className="h-3.5 w-3.5" /> Registrar primera llave</Button>}
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-slate-800/50">
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Código</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Etiqueta</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Tipo</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Estado</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Responsable</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Ubicación</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Copias</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKeys.map((k: any) => {
                        const sc = statusConfig[k.status] || statusConfig.available;
                        return (
                          <tr key={k.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="p-3 font-mono text-xs font-bold text-white">{k.keyCode}</td>
                            <td className="p-3">
                              <div className="font-medium text-white text-sm">{k.label}</div>
                              {k.description && <div className="text-[10px] text-slate-500 truncate max-w-[200px]">{k.description}</div>}
                            </td>
                            <td className="p-3"><Badge variant="outline" className="text-[9px] capitalize">{typeLabels[k.keyType] || k.keyType}</Badge></td>
                            <td className="p-3"><Badge className={cn("text-[9px] border", sc.color)}>{sc.label}</Badge></td>
                            <td className="p-3 text-sm">{k.currentHolder ? <span className="text-white font-medium">{k.currentHolder}</span> : <span className="text-slate-600">—</span>}</td>
                            <td className="p-3 text-xs">{k.location ? <span className="flex items-center gap-1 text-slate-400"><MapPin className="h-3 w-3" />{k.location}</span> : <span className="text-slate-600">—</span>}</td>
                            <td className="p-3 text-center text-xs text-slate-400">{k.copies ?? 1}</td>
                            <td className="p-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditKey(k)}><Pencil className="mr-2 h-3 w-3" /> Editar</DropdownMenuItem>
                                  {k.status === 'available' && <DropdownMenuItem onClick={() => openAssignDialog(k)}><ArrowRightLeft className="mr-2 h-3 w-3" /> Asignar</DropdownMenuItem>}
                                  {k.status === 'assigned' && (
                                    <>
                                      <DropdownMenuItem onClick={() => openReturnDialog(k)}><RotateCcw className="mr-2 h-3 w-3" /> Devolver</DropdownMenuItem>
                                      <DropdownMenuItem className="text-amber-400" onClick={() => reportLostMut.mutate(k.id)}><AlertTriangle className="mr-2 h-3 w-3" /> Reportar Perdida</DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(k)}><Trash2 className="mr-2 h-3 w-3" /> Eliminar</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-[10px] text-slate-500 mt-2">{filteredKeys.length} llave(s)</p>
        </TabsContent>

        {/* ═══ Activity Log Tab ═══ */}
        <TabsContent value="logs">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardContent className="p-0">
              {loadingLogs ? (
                <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <History className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Sin registros de actividad</p>
                  <p className="text-xs mt-1">Los registros aparecerán cuando se asignen o devuelvan llaves</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-slate-800/50">
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Llave</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Acción</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">De</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Para</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Notas</th>
                        <th className="p-3 text-left text-xs text-slate-400 font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((l: any) => {
                        const ac = actionConfig[l.action] || actionConfig.assigned;
                        return (
                          <tr key={l.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="p-3 font-mono text-xs font-bold text-white">{l.keyCode || l.keyLabel || '—'}</td>
                            <td className="p-3"><Badge className={cn("text-[9px] border", ac.color)}>{ac.label}</Badge></td>
                            <td className="p-3 text-xs text-slate-300">{l.fromHolder || '—'}</td>
                            <td className="p-3 text-xs text-slate-300">{l.toHolder || '—'}</td>
                            <td className="p-3 text-xs text-slate-500 max-w-[200px] truncate">{l.notes || '—'}</td>
                            <td className="p-3 text-xs text-slate-400">{new Date(l.createdAt || l.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-[10px] text-slate-500 mt-2">{filteredLogs.length} registro(s)</p>
        </TabsContent>
      </Tabs>

      {/* ═══ Create/Edit Key Dialog ═══ */}
      <Dialog open={showKeyDialog} onOpenChange={o => { if (!o) closeKeyDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingKey ? 'Editar Llave' : 'Nueva Llave'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Código *</Label><Input value={keyForm.keyCode} onChange={e => setKeyForm(f => ({ ...f, keyCode: e.target.value }))} placeholder="LL-001" maxLength={64} className="bg-slate-900 border-slate-700 font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Tipo</Label>
                <Select value={keyForm.keyType} onValueChange={v => setKeyForm(f => ({ ...f, keyType: v }))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Maestra</SelectItem>
                    <SelectItem value="access">Acceso</SelectItem>
                    <SelectItem value="cabinet">Gabinete</SelectItem>
                    <SelectItem value="vehicle">Vehículo</SelectItem>
                    <SelectItem value="other">Otra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Etiqueta *</Label><Input value={keyForm.label} onChange={e => setKeyForm(f => ({ ...f, label: e.target.value }))} placeholder="Llave principal portería" maxLength={255} className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Descripción</Label><Textarea value={keyForm.description} onChange={e => setKeyForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles adicionales..." rows={2} className="bg-slate-900 border-slate-700" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Ubicación</Label><Input value={keyForm.location} onChange={e => setKeyForm(f => ({ ...f, location: e.target.value }))} placeholder="Portería / Oficina" className="bg-slate-900 border-slate-700" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Copias</Label><Input type="number" min={1} value={keyForm.copies} onChange={e => setKeyForm(f => ({ ...f, copies: parseInt(e.target.value) || 1 }))} className="bg-slate-900 border-slate-700" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Notas</Label><Textarea value={keyForm.notes} onChange={e => setKeyForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones sobre esta llave..." rows={2} className="bg-slate-900 border-slate-700" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeKeyDialog}>Cancelar</Button>
            <Button onClick={handleKeySubmit} disabled={!keyForm.keyCode || !keyForm.label || createMut.isPending || updateMut.isPending} className="gap-1">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingKey ? 'Actualizar' : 'Crear Llave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Assign Dialog ═══ */}
      <Dialog open={showAssignDialog} onOpenChange={o => { if (!o) closeAssignDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar Llave: {assignTarget?.keyCode}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-slate-800/50 text-sm"><span className="font-medium text-white">{assignTarget?.label}</span>{assignTarget?.location && <span className="text-slate-400"> — {assignTarget.location}</span>}</div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Asignar a *</Label><Input value={assignHolder} onChange={e => setAssignHolder(e.target.value)} placeholder="Nombre del responsable" className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Notas</Label><Textarea value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="Motivo de asignación..." rows={2} className="bg-slate-900 border-slate-700" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAssignDialog}>Cancelar</Button>
            <Button onClick={() => assignMut.mutate({ id: assignTarget.id, toHolder: assignHolder, notes: assignNotes || undefined })} disabled={!assignHolder || assignMut.isPending} className="gap-1">
              {assignMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Return Dialog ═══ */}
      <Dialog open={showReturnDialog} onOpenChange={o => { if (!o) closeReturnDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Devolver Llave: {returnTarget?.keyCode}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-slate-800/50 text-sm">
              <div className="font-medium text-white">{returnTarget?.label}</div>
              <div className="text-slate-400 mt-1">Responsable actual: <span className="text-white font-medium">{returnTarget?.currentHolder}</span></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Estado / Notas</Label><Textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Condición de la llave, observaciones..." rows={2} className="bg-slate-900 border-slate-700" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReturnDialog}>Cancelar</Button>
            <Button onClick={() => returnMut.mutate({ id: returnTarget.id, notes: returnNotes || undefined })} disabled={returnMut.isPending} className="gap-1">
              {returnMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Confirmation ═══ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Llave</AlertDialogTitle>
            <AlertDialogDescription>¿Eliminar la llave <span className="font-medium text-white">"{deleteTarget?.keyCode} — {deleteTarget?.label}"</span>? Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMut.mutate(deleteTarget.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageShell>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="bg-slate-800/40 border-slate-700/50">
      <CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-xs text-slate-400">{label}</p><p className={cn("text-2xl font-bold", color)}>{value}</p></div>
        {icon}
      </CardContent>
    </Card>
  );
}
