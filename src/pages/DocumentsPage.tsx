import { useState, useCallback, useRef } from 'react';
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
  FileText, Upload, Download, Trash2, Search, FolderOpen, File, Image,
  FileSpreadsheet, Eye, Plus, X,
} from 'lucide-react';

// ── Constants ───────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const CATEGORIES = [
  { value: 'contrato', label: 'Contrato', color: 'text-primary' },
  { value: 'reporte', label: 'Reporte', color: 'text-success' },
  { value: 'minuta', label: 'Minuta', color: 'text-purple-400' },
  { value: 'procedimiento', label: 'Procedimiento', color: 'text-warning' },
  { value: 'evidencia', label: 'Evidencia', color: 'text-destructive' },
  { value: 'general', label: 'General', color: 'text-gray-400' },
];

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
  'text/plain',
];

const ACCEPT_STRING = '.pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.txt';

type SortField = 'created_at' | 'name' | 'size';
type SortDir = 'asc' | 'desc';

interface DocumentRow {
  id: string;
  tenant_id: string;
  name: string;
  original_name: string;
  size: number;
  mime_type: string;
  category: string;
  description: string | null;
  storage_path: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
  file_data?: string | null;
}

// ── Helpers ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForMime(mime: string) {
  if (mime.startsWith('image/')) return <Image size={20} className="text-pink-400" />;
  if (mime === 'application/pdf') return <FileText size={20} className="text-destructive" />;
  if (mime.includes('word')) return <FileText size={20} className="text-primary" />;
  if (mime.includes('spreadsheet') || mime === 'text/csv') return <FileSpreadsheet size={20} className="text-success" />;
  if (mime.startsWith('text/')) return <FileText size={20} className="text-gray-400" />;
  return <File size={20} className="text-gray-400" />;
}

function categoryBadge(cat: string) {
  const found = CATEGORIES.find(c => c.value === cat);
  if (!found) return <Badge variant="outline">{cat}</Badge>;
  return <Badge variant="outline" className={found.color}>{found.label}</Badge>;
}

function fileToBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Component ───────────────────────────────────────────────

const DocumentsPage = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Preview dialog
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Drag state
  const [dragOver, setDragOver] = useState(false);

  const tenantId = (profile as any)?.tenant_id || user?.id || 'default';

  // ── Query: list documents ─────────────────────────────────
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', tenantId],
    queryFn: async () => {
      const response = await apiClient.get<any>('/database-records', { category: 'document' });
      return (Array.isArray(response.data) ? response.data : []) as DocumentRow[];
    },
    enabled: !!user,
  });

  // ── Filtered & sorted ─────────────────────────────────────
  const filtered = (documents as DocumentRow[])
    .filter(d => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (searchTerm && !d.original_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === 'name') cmp = a.original_name.localeCompare(b.original_name);
      else if (sortField === 'size') cmp = a.size - b.size;
      return sortDir === 'desc' ? -cmp : cmp;
    });

  // ── Upload mutation ───────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      setUploadProgress(10);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Convert file to base64 for backend storage
      setUploadProgress(30);
      const fileDataB64 = await fileToBase64(file);

      setUploadProgress(60);

      // Upload via Fastify backend (handles storage + metadata + audit)
      await apiClient.post('/database-records', {
        category: 'document',
        title: safeName,
        content: {
          name: safeName,
          original_name: file.name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
          doc_category: uploadCategory,
          description: uploadDescription || null,
          file_data: fileDataB64,
        },
      });

      setUploadProgress(100);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Documento subido', description: 'El archivo se ha guardado correctamente.' });
      resetUploadForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error al subir', description: err.message, variant: 'destructive' });
      setUploading(false);
      setUploadProgress(0);
    },
  });

  // ── Delete mutation ───────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      await apiClient.delete(`/database-records/${doc.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Eliminado', description: 'El documento fue eliminado.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
    },
  });

  // ── Handlers ──────────────────────────────────────────────
  function resetUploadForm() {
    setSelectedFile(null);
    setUploadCategory('general');
    setUploadDescription('');
    setUploading(false);
    setUploadProgress(0);
    setUploadOpen(false);
  }

  function handleFileSelect(file: globalThis.File | null) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'Archivo demasiado grande', description: 'El tamaño máximo es 10 MB.', variant: 'destructive' });
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|docx|xlsx|csv|jpg|jpeg|png|txt)$/i)) {
      toast({ title: 'Tipo no soportado', description: 'Seleccione un archivo PDF, Word, Excel, imagen o texto.', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    if (!uploadOpen) setUploadOpen(true);
  }

  function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    uploadMutation.mutate(selectedFile);
  }

  async function handleDownload(doc: DocumentRow) {
    try {
      const fileData = doc.file_data || (doc as any).content?.file_data;
      if (fileData) {
        const a = document.createElement('a');
        a.href = fileData;
        a.download = doc.original_name;
        a.click();
        return;
      }
      // Fetch from backend if no inline data
      const response = await apiClient.get<any>(`/database-records/${doc.id}`);
      const data = response.data?.content?.file_data;
      if (data) {
        const a = document.createElement('a');
        a.href = data;
        a.download = doc.original_name;
        a.click();
      }
    } catch (err: any) {
      toast({ title: 'Error al descargar', description: err.message, variant: 'destructive' });
    }
  }

  async function handlePreview(doc: DocumentRow) {
    setPreviewDoc(doc);
    try {
      const fileData = doc.file_data || (doc as any).content?.file_data;
      if (fileData) {
        setPreviewUrl(fileData);
        return;
      }
      const response = await apiClient.get<any>(`/database-records/${doc.id}`);
      setPreviewUrl(response.data?.content?.file_data || null);
    } catch {
      setPreviewUrl(null);
    }
  }

  // ── Drag & Drop ───────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadOpen]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-2 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen size={28} /> Gestión de Documentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sube, organiza y gestiona todos los documentos de tu organización.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Plus size={16} /> Subir Documento
        </Button>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/30 hover:border-primary/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={36} className="mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastra un archivo aquí o <span className="text-primary underline">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Word, Excel, CSV, Imágenes (JPG/PNG), Texto — Máx. 10 MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          className="hidden"
          onChange={e => handleFileSelect(e.target.files?.[0] || null)}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Nombre del archivo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-full sm:w-44">
              <Label className="text-xs text-muted-foreground mb-1 block">Categoría</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <Label className="text-xs text-muted-foreground mb-1 block">Ordenar por</Label>
              <Select
                value={`${sortField}_${sortDir}`}
                onValueChange={v => {
                  const [f, d] = v.split('_') as [SortField, SortDir];
                  setSortField(f);
                  setSortDir(d);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">Fecha (reciente)</SelectItem>
                  <SelectItem value="created_at_asc">Fecha (antiguo)</SelectItem>
                  <SelectItem value="name_asc">Nombre A-Z</SelectItem>
                  <SelectItem value="name_desc">Nombre Z-A</SelectItem>
                  <SelectItem value="size_desc">Tamaño (mayor)</SelectItem>
                  <SelectItem value="size_asc">Tamaño (menor)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document list */}
      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FolderOpen size={48} className="mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No se encontraron documentos</p>
            <p className="text-sm mt-1">Sube tu primer documento con el botón de arriba.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(doc => (
            <Card key={doc.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {/* Icon + name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0">{iconForMime(doc.mime_type)}</div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" title={doc.original_name}>
                        {doc.original_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatBytes(doc.size)}</span>
                        <span>·</span>
                        <span>{new Date(doc.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span>·</span>
                        <span>{doc.uploaded_by_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="shrink-0">
                    {categoryBadge(doc.category)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" title="Vista previa" onClick={() => handlePreview(doc)}>
                      <Eye size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Descargar" onClick={() => handleDownload(doc)}>
                      <Download size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Eliminar"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) {
                          deleteMutation.mutate(doc);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {/* Description */}
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-2 pl-8">{doc.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary bar */}
      {!isLoading && documents.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} de {documents.length} documentos · Tamaño total: {formatBytes(filtered.reduce((s, d) => s + d.size, 0))}
        </p>
      )}

      {/* ── Upload Dialog ──────────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={open => { if (!uploading) { if (!open) resetUploadForm(); else setUploadOpen(true); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload size={20} /> Subir Documento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* File selection */}
            <div>
              <Label>Archivo</Label>
              {selectedFile ? (
                <div className="flex items-center gap-2 mt-1 p-2 rounded border bg-muted/40">
                  {iconForMime(selectedFile.type)}
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedFile(null)}>
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <div className="mt-1">
                  <Input
                    type="file"
                    accept={ACCEPT_STRING}
                    onChange={e => handleFileSelect(e.target.files?.[0] || null)}
                  />
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <Label>Categoría</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label>Descripción / Notas</Label>
              <Textarea
                className="mt-1"
                placeholder="Opcional: agrega una descripción..."
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Progress */}
            {uploading && (
              <div className="space-y-1">
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">{uploadProgress}%</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetUploadForm} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading} className="gap-2">
              <Upload size={14} /> {uploading ? 'Subiendo...' : 'Subir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ─────────────────────────────────── */}
      <Dialog open={!!previewDoc} onOpenChange={open => { if (!open) { setPreviewDoc(null); setPreviewUrl(null); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 truncate">
              <Eye size={18} /> {previewDoc?.original_name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            {previewDoc && previewUrl ? (
              previewDoc.mime_type.startsWith('image/') ? (
                <img src={previewUrl} alt={previewDoc.original_name} className="max-w-full rounded mx-auto" />
              ) : previewDoc.mime_type === 'application/pdf' ? (
                <iframe src={previewUrl} className="w-full h-[60vh] rounded border" title={previewDoc.original_name} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <File size={48} className="mx-auto mb-4 opacity-40" />
                  <p>Vista previa no disponible para este tipo de archivo.</p>
                  <Button variant="outline" className="mt-4 gap-2" onClick={() => previewDoc && handleDownload(previewDoc)}>
                    <Download size={14} /> Descargar archivo
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No se pudo cargar la vista previa.</p>
                {previewDoc && (
                  <Button variant="outline" className="mt-4 gap-2" onClick={() => handleDownload(previewDoc)}>
                    <Download size={14} /> Descargar archivo
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsPage;
