// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Línea de Tiempo de Detecciones
// Visualización de detecciones de cámaras con filtros y análisis IA
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/shared/PageShell';
import {
  Camera, ChevronLeft, ChevronRight, Eye, Sparkles,
  Search, Users, Car, Bug, Loader2, Clock, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Constants ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  person: 'Persona',
  vehicle: 'Vehículo',
  animal: 'Animal',
  unknown: 'Desconocido',
};

const TYPE_COLORS: Record<string, string> = {
  person: 'bg-blue-500',
  vehicle: 'bg-amber-500',
  animal: 'bg-green-500',
  unknown: 'bg-slate-500',
};

const TYPE_BADGE_STYLES: Record<string, string> = {
  person: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  vehicle: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  animal: 'bg-green-500/10 text-green-400 border-green-500/30',
  unknown: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const PAGE_SIZE = 20;

// ── Types ─────────────────────────────────────────────────────

interface Detection {
  id: string;
  site_id: string;
  camera_id: string;
  ts: string;
  type: string;
  confidence: number;
  bbox_json: Record<string, unknown>;
  snapshot_path: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

interface DetectionsResponse {
  data: Detection[];
  meta: { total: number; page: number; limit: number };
}

interface StatsResponse {
  total: number;
  persons: number;
  vehicles: number;
  pending: number;
}

// ── Main Component ────────────────────────────────────────────

export default function DetectionsTimelinePage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [minConfidence, setMinConfidence] = useState('');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  const queryClient = useQueryClient();

  // ── Query: Stats ────────────────────────────────────────
  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ['camera-detections-stats'],
    queryFn: () => apiClient.get<StatsResponse>('/camera-detections/stats'),
    staleTime: 30_000,
  });

  // ── Query: Detections List ──────────────────────────────
  const queryParams: Record<string, string | number> = {
    page,
    perPage: PAGE_SIZE,
  };
  if (typeFilter !== 'all') queryParams.type = typeFilter;
  if (dateFrom) queryParams.dateFrom = dateFrom;
  if (dateTo) queryParams.dateTo = dateTo;
  if (search.trim()) queryParams.search = search.trim();
  if (minConfidence) queryParams.minConfidence = minConfidence;

  const {
    data: detectionsResult,
    isLoading,
    isError,
    error,
  } = useQuery<DetectionsResponse>({
    queryKey: ['camera-detections', queryParams],
    queryFn: () => apiClient.get<DetectionsResponse>('/camera-detections', queryParams),
    staleTime: 15_000,
  });

  const detections: Detection[] = detectionsResult?.data ?? [];
  const totalCount = detectionsResult?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Mutation: Mark Reviewed ─────────────────────────────
  const reviewMut = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/camera-detections/${id}/review`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera-detections'] });
      queryClient.invalidateQueries({ queryKey: ['camera-detections-stats'] });
      toast.success('Detección marcada como revisada');
      setSelectedDetection(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Mutation: AI Analysis ──────────────────────────────
  const aiAnalysisMut = useMutation({
    mutationFn: (detection: Detection) =>
      apiClient.post<{ message: string }>('/ai/chat', {
        message: `Analiza esta detección de seguridad: tipo=${detection.type}, confianza=${Math.round(detection.confidence * 100)}%, fecha=${new Date(detection.ts).toLocaleString('es-CO')}, cámara=${detection.camera_id}. Proporciona un análisis breve de riesgo y recomendaciones.`,
      }),
    onSuccess: (data) => {
      const response = data as Record<string, unknown>;
      const message = (response?.message ?? response?.data ?? 'Análisis completado') as string;
      toast.success(message, { duration: 8000 });
    },
    onError: (e: Error) => toast.error(`Error en análisis IA: ${e.message}`),
  });

  return (
    <PageShell
      title="Detecciones"
      description="Línea de tiempo de detecciones de cámaras"
      icon={<Eye className="h-5 w-5" />}
    >
      <div className="p-5 space-y-5">

        {/* ── Stats Cards ────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Eye className="h-4 w-4 text-blue-400" />}
            label="Total"
            value={stats?.total ?? 0}
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-indigo-400" />}
            label="Personas"
            value={stats?.persons ?? 0}
          />
          <StatCard
            icon={<Car className="h-4 w-4 text-amber-400" />}
            label="Vehículos"
            value={stats?.vehicles ?? 0}
          />
          <StatCard
            icon={<ShieldCheck className="h-4 w-4 text-green-400" />}
            label="Pendientes de revisión"
            value={stats?.pending ?? 0}
          />
        </div>

        {/* ── Filter Bar ─────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar detecciones..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-36 h-8 text-xs"
            placeholder="Desde"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-36 h-8 text-xs"
            placeholder="Hasta"
          />
          <Input
            type="number"
            min="0"
            max="100"
            step="5"
            value={minConfidence}
            onChange={(e) => { setMinConfidence(e.target.value); setPage(1); }}
            className="w-28 h-8 text-xs"
            placeholder="Confianza mín %"
          />
        </div>

        {/* ── Error State ────────────────────────────────── */}
        {isError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                Error al cargar detecciones:{' '}
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Detections Grid ────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-lg" />
            ))}
          </div>
        ) : detections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Eye className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">
              {search || typeFilter !== 'all' || dateFrom || dateTo
                ? 'Sin resultados para los filtros aplicados'
                : 'No hay detecciones registradas'}
            </p>
            {(search || typeFilter !== 'all' || dateFrom || dateTo) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); setMinConfidence(''); }}
                className="mt-2"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {detections.map((detection) => (
                <Card
                  key={detection.id}
                  className="bg-card hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => setSelectedDetection(detection)}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header: type badge + confidence */}
                    <div className="flex items-center justify-between">
                      <Badge className={`text-xs border ${TYPE_BADGE_STYLES[detection.type] ?? TYPE_BADGE_STYLES.unknown}`}>
                        {TYPE_LABELS[detection.type] ?? 'Desconocido'}
                      </Badge>
                      {detection.reviewed_at && (
                        <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                          Revisado
                        </Badge>
                      )}
                    </div>

                    {/* Confidence bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Confianza</span>
                        <span className="font-mono">{Math.round(detection.confidence * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${TYPE_COLORS[detection.type] ?? TYPE_COLORS.unknown}`}
                          style={{ width: `${Math.round(detection.confidence * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Timestamp + camera */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(detection.ts).toLocaleDateString('es-CO', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {detection.camera_id.slice(0, 8)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ── Pagination ───────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-7 text-xs gap-1"
                  >
                    <ChevronLeft className="h-3 w-3" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 text-xs gap-1"
                  >
                    Siguiente <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Detail Dialog ──────────────────────────────── */}
        <Dialog
          open={!!selectedDetection}
          onOpenChange={(o) => { if (!o) setSelectedDetection(null); }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalle de Detección</DialogTitle>
            </DialogHeader>
            {selectedDetection && (
              <div className="space-y-4">
                {/* Snapshot */}
                <div className="rounded-lg overflow-hidden bg-muted aspect-video flex items-center justify-center">
                  {selectedDetection.snapshot_path ? (
                    <img
                      src={selectedDetection.snapshot_path}
                      alt="Captura de detección"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8 opacity-30" />
                      <span>Sin captura</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs border ${TYPE_BADGE_STYLES[selectedDetection.type] ?? TYPE_BADGE_STYLES.unknown}`}>
                    {TYPE_LABELS[selectedDetection.type] ?? 'Desconocido'}
                  </Badge>
                  <span className="text-sm font-mono text-muted-foreground">
                    {Math.round(selectedDetection.confidence * 100)}% confianza
                  </span>
                </div>

                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(selectedDetection.ts).toLocaleString('es-CO', {
                    day: '2-digit', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </div>

                {selectedDetection.notes && (
                  <p className="text-sm text-muted-foreground italic">
                    {selectedDetection.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => reviewMut.mutate(selectedDetection.id)}
                    disabled={reviewMut.isPending || !!selectedDetection.reviewed_at}
                  >
                    {reviewMut.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <ShieldCheck className="h-3.5 w-3.5" />}
                    {selectedDetection.reviewed_at ? 'Ya revisado' : 'Marcar como revisado'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => aiAnalysisMut.mutate(selectedDetection)}
                    disabled={aiAnalysisMut.isPending}
                  >
                    {aiAnalysisMut.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5" />}
                    Analizar con IA
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageShell>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value.toLocaleString('es-CO')}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
