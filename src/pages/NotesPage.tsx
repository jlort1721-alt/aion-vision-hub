import { useState } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
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
  StickyNote, Plus, Search, Pin, PinOff, Pencil, Trash2, Clock, AlertCircle,
} from 'lucide-react';
import { sanitizeText } from '@/lib/sanitize';

const CATEGORIES = [
  { value: 'operativa', label: 'Operativa', color: 'text-primary' },
  { value: 'incidente', label: 'Incidente', color: 'text-destructive' },
  { value: 'turno', label: 'Turno', color: 'text-purple-400' },
  { value: 'dispositivo', label: 'Dispositivo', color: 'text-warning' },
  { value: 'mantenimiento', label: 'Mantenimiento', color: 'text-warning' },
  { value: 'general', label: 'General', color: 'text-gray-400' },
];

const PRIORITIES = [
  { value: 'alta', label: 'Alta', variant: 'destructive' as const },
  { value: 'media', label: 'Media', variant: 'default' as const },
  { value: 'baja', label: 'Baja', variant: 'secondary' as const },
];

interface Note {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  is_pinned: boolean;
  author_name: string;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 25;

export default function NotesPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [deleteNote, setDeleteNote] = useState<Note | null>(null);
  const [form, setForm] = useState({ title: '', body: '', category: 'general', priority: 'media' });

  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['operational_notes', profile?.tenant_id],
    queryFn: async () => {
      const response = await apiClient.get<any>('/database-records', { category: 'operational_note' });
      return (Array.isArray(response.data) ? response.data : []) as unknown as Note[];
    },
    enabled: !!profile?.tenant_id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('El título es obligatorio');
      const payload = {
        tenant_id: profile?.tenant_id,
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        priority: form.priority,
        is_pinned: false,
        author_id: profile?.user_id,
        author_name: profile?.full_name || 'Operador',
      };
      if (editNote) {
        await apiClient.patch(`/database-records/${editNote.id}`, payload);
      } else {
        await apiClient.post('/database-records', { ...payload, category: 'operational_note' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_notes'] });
      setFormOpen(false);
      setEditNote(null);
      setForm({ title: '', body: '', category: 'general', priority: 'media' });
      toast({ title: editNote ? 'Nota actualizada' : 'Nota creada' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const togglePin = useMutation({
    mutationFn: async (note: Note) => {
      await apiClient.patch(`/database-records/${note.id}`, { is_pinned: !note.is_pinned });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operational_notes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/database-records/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational_notes'] });
      setDeleteNote(null);
      toast({ title: 'Nota eliminada' });
    },
  });

  const openEdit = (note: Note) => {
    setEditNote(note);
    setForm({ title: note.title, body: note.body, category: note.category, priority: note.priority });
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditNote(null);
    setForm({ title: '', body: '', category: 'general', priority: 'media' });
    setFormOpen(true);
  };

  const filtered = notes.filter(n => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.body.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginatedNotes = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getCategoryColor = (cat: string) => CATEGORIES.find(c => c.value === cat)?.color || 'text-gray-400';
  const getPriorityVariant = (pri: string) => PRIORITIES.find(p => p.value === pri)?.variant || 'secondary';

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notas Operativas</h1>
          <p className="text-sm text-muted-foreground">Registro de notas y observaciones del centro de monitoreo</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva Nota
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar notas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <StickyNote className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">{search || categoryFilter !== 'all' ? 'No hay notas que coincidan con los filtros' : 'No hay notas registradas'}</p>
          <Button variant="link" size="sm" onClick={openCreate}>Crear primera nota</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedNotes.map(note => (
              <Card key={note.id} className={`relative transition-colors hover:border-primary/30 ${note.is_pinned ? 'border-warning/30 bg-warning/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {note.is_pinned && <Pin className="h-3 w-3 text-warning shrink-0" />}
                      <h3 className="font-semibold text-sm truncate">{note.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePin.mutate(note)} title={note.is_pinned ? 'Desfijar' : 'Fijar'}>
                        {note.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(note)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteNote(note)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{note.body ? sanitizeText(note.body) : 'Sin contenido'}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className={`text-[9px] ${getCategoryColor(note.category)}`}>
                        {CATEGORIES.find(c => c.value === note.category)?.label || note.category}
                      </Badge>
                      <Badge variant={getPriorityVariant(note.priority)} className="text-[9px]">
                        {PRIORITIES.find(p => p.value === note.priority)?.label || note.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(note.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Por: {note.author_name}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editNote ? 'Editar Nota' : 'Nueva Nota'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título de la nota" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Contenido</Label>
              <Textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Detalle de la nota..." rows={4} maxLength={2000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Guardando...' : editNote ? 'Actualizar' : 'Crear Nota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteNote} onOpenChange={() => setDeleteNote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" /> Eliminar Nota
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de eliminar la nota <strong>"{deleteNote?.title}"</strong>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNote(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteNote && deleteMutation.mutate(deleteNote.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
