import { useState, useMemo, useCallback } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StickyNote, Plus, Search, Pin, PinOff, Pencil, Trash2, Clock, User,
  ChevronLeft, ChevronRight, Loader2, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PageShell } from '@/components/shared/PageShell';

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  { value: 'operativa', label: 'Operativa', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 'incidente', label: 'Incidente', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  { value: 'turno', label: 'Turno', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { value: 'dispositivo', label: 'Dispositivo', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 'mantenimiento', label: 'Mantenimiento', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
] as const;

const PRIORITIES = [
  { value: 'alta', label: 'Alta', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  { value: 'media', label: 'Media', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 'baja', label: 'Baja', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
] as const;

const PAGE_SIZE = 30;

function getCategoryConfig(cat: string) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
}
function getPriorityConfig(pri: string) {
  return PRIORITIES.find(p => p.value === pri) || PRIORITIES[1];
}

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

export default function NotesPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editNote, setEditNote] = useState<any>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteNoteTitle, setDeleteNoteTitle] = useState('');
  const [form, setForm] = useState({ title: '', body: '', category: 'general', priority: 'media' });

  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // ── Query: uses the new /notes endpoint (backed by operational_notes table) ──
  const queryParams: Record<string, string | number> = { page, perPage: PAGE_SIZE };
  if (categoryFilter !== 'all') queryParams.category = categoryFilter;
  if (search.trim()) queryParams.search = search.trim();

  const { data: result, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['operational_notes', queryParams],
    queryFn: async () => {
      const resp = await apiClient.get<any>('/notes', queryParams);
      return resp;
    },
    enabled: !!profile,
  });

  const notes: any[] = (result as any)?.data ?? (result as any)?.items ?? (Array.isArray(result) ? result : []);
  const totalCount: number = Number((result as any)?.meta?.total ?? notes.length);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Stats ──
  const stats = useMemo(() => ({
    total: totalCount,
    pinned: notes.filter((n: any) => n.isPinned || n.is_pinned).length,
    alta: notes.filter((n: any) => n.priority === 'alta').length,
  }), [notes, totalCount]);

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('El título es obligatorio');
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        priority: form.priority,
        isPinned: false,
      };
      if (editNote) {
        await apiClient.patch(`/notes/${editNote.id}`, payload);
      } else {
        await apiClient.post('/notes', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_notes'] });
      setFormOpen(false);
      setEditNote(null);
      setForm({ title: '', body: '', category: 'general', priority: 'media' });
      toast.success(editNote ? 'Nota actualizada' : 'Nota creada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePinMut = useMutation({
    mutationFn: async (note: any) => {
      const pinned = note.isPinned ?? note.is_pinned ?? false;
      await apiClient.patch(`/notes/${note.id}`, { isPinned: !pinned });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operational_notes'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/notes/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_notes'] });
      setDeleteNoteId(null);
      toast.success('Nota eliminada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Handlers ──
  const openEdit = useCallback((note: any) => {
    setEditNote(note);
    setForm({ title: note.title, body: note.body || '', category: note.category || 'general', priority: note.priority || 'media' });
    setFormOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    setEditNote(null);
    setForm({ title: '', body: '', category: 'general', priority: 'media' });
    setFormOpen(true);
  }, []);

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title="Notas Operativas"
      description="Registro de notas y observaciones del centro de monitoreo"
      icon={<StickyNote className="h-5 w-5" />}
      actions={<Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nueva Nota</Button>}
    >
    <div className="p-5 space-y-5">

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <MiniStat icon={<StickyNote className="h-3.5 w-3.5 text-blue-400" />} label="Total" value={stats.total} />
        <MiniStat icon={<Pin className="h-3.5 w-3.5 text-amber-400" />} label="Fijadas" value={stats.pinned} />
        <MiniStat icon={<Clock className="h-3.5 w-3.5 text-red-400" />} label="Prioridad alta" value={stats.alta} />
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input placeholder="Buscar notas..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-sm bg-slate-900/50 border-slate-700" />
        </div>
        <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 h-8 text-xs bg-slate-900/50 border-slate-700">
            <Filter className="h-3 w-3 mr-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Notes Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <StickyNote className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">{search || categoryFilter !== 'all' ? 'Sin resultados para el filtro actual' : 'No hay notas registradas'}</p>
          {!(search || categoryFilter !== 'all') && (
            <Button size="sm" variant="ghost" onClick={openCreate} className="mt-2 gap-1"><Plus className="h-3.5 w-3.5" /> Crear primera nota</Button>
          )}
          {(search || categoryFilter !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setCategoryFilter('all'); }} className="mt-2">Limpiar filtros</Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {notes.map((note: any) => {
              const isPinned = note.isPinned ?? note.is_pinned ?? false;
              const catCfg = getCategoryConfig(note.category);
              const priCfg = getPriorityConfig(note.priority);
              const authorName = note.authorName || note.author_name || 'Operador';
              const createdAt = note.createdAt || note.created_at;

              return (
                <Card
                  key={note.id}
                  className={cn(
                    "bg-slate-800/40 border-slate-700/50 hover:border-slate-600 transition-all group",
                    isPinned && "border-amber-500/30 bg-amber-500/5"
                  )}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {isPinned && <Pin className="h-3 w-3 text-amber-400 shrink-0" />}
                        <h3 className="font-semibold text-sm text-white truncate">{note.title}</h3>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => togglePinMut.mutate(note)} title={isPinned ? 'Desfijar' : 'Fijar'}>
                          {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => openEdit(note)} title="Editar">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => { setDeleteNoteId(note.id); setDeleteNoteTitle(note.title); }} title="Eliminar">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Body */}
                    <p className="text-xs text-slate-400 line-clamp-3 mb-3 min-h-[2.5rem]">
                      {note.body || 'Sin contenido'}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        <Badge className={cn("text-[9px] border", catCfg.color)}>{catCfg.label}</Badge>
                        <Badge className={cn("text-[9px] border", priCfg.color)}>{priCfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="h-2.5 w-2.5" />
                        {createdAt ? new Date(createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </div>

                    {/* Author */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1.5">
                      <User className="h-2.5 w-2.5" /> {authorName}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs gap-1">
                  <ChevronLeft className="h-3 w-3" /> Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7 text-xs gap-1">
                  Siguiente <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={o => { if (!o) { setFormOpen(false); setEditNote(null); } else setFormOpen(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editNote ? 'Editar Nota' : 'Nueva Nota'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Título *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título de la nota" maxLength={200} className="bg-slate-900 border-slate-700" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Contenido</Label>
              <Textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Detalle de la nota, observaciones..." rows={5} maxLength={4000} className="bg-slate-900 border-slate-700" />
              <p className="text-[10px] text-slate-600 text-right">{form.body.length}/4000</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Prioridad</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.title.trim() || createMut.isPending} className="gap-1">
              {createMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editNote ? 'Actualizar' : 'Crear Nota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={o => { if (!o) setDeleteNoteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Nota</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar la nota <span className="font-medium text-white">"{deleteNoteTitle}"</span>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteNoteId && deleteMut.mutate(deleteNoteId)}
            >
              {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/50 border border-slate-700/30">
      {icon}
      <span className="text-xs font-semibold text-white">{value}</span>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}
