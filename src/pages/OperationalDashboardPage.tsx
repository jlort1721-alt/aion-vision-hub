// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Panel Operativo
// Dashboard principal con estadisticas de los 13 modulos
// ═══════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { PageShell } from '@/components/shared/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Users,
  Car,
  Fingerprint,
  ClipboardList,
  Siren,
  RotateCcw,
  DoorOpen,
  Video,
  ArrowRight,
  Search,
  Plus,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  LayoutDashboard,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

interface OperationalStats {
  residents: {
    total: number;
    active: number;
  };
  vehicles: {
    total: number;
  };
  biometric: {
    total: number;
    coveragePercent: number;
  };
  consignas: {
    active: number;
  };
  sirenTests: {
    lastResult: 'ok' | 'fail' | 'pending' | null;
    totalTests: number;
    lastTestDate: string | null;
  };
  restarts: {
    lastDate: string | null;
    totalRestarts: number;
  };
  doors: {
    totalDoors: number;
    ewelinkCount: number;
  };
  cameras: {
    totalStreams: number;
    online: number;
  };
  recentActivity: ActivityEntry[];
}

interface ActivityEntry {
  id: string;
  type: 'siren_test' | 'restart';
  description: string;
  result?: 'ok' | 'fail';
  timestamp: string;
  site?: string;
}

// ── Stat Card Component ────────────────────────────────────

interface StatCardProps {
  title: string;
  icon: React.ReactNode;
  value: string | number;
  subtitle?: string;
  badge?: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
  href: string;
  external?: boolean;
}

function StatCard({ title, icon, value, subtitle, badge, href, external }: StatCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (external) {
      window.open(href, '_blank', 'noopener');
    } else {
      navigate(href);
    }
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground group-hover:text-primary transition-colors">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <Badge variant={badge.variant} className="text-xs">
                {badge.label}
              </Badge>
            )}
            {external ? (
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Loading Skeleton ───────────────────────────────────────

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// ── Activity Item ──────────────────────────────────────────

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const isSiren = entry.type === 'siren_test';

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isSiren ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'
        }`}
      >
        {isSiren ? <Siren className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{entry.description}</span>
          {entry.result && (
            entry.result === 'ok' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            )
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(entry.timestamp)}
          </span>
          {entry.site && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {entry.site}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHrs = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: diffDays > 365 ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Sin registro';
  try {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function sirenResultLabel(result: string | null): { label: string; variant: 'default' | 'destructive' | 'secondary' } {
  switch (result) {
    case 'ok':
      return { label: 'OK', variant: 'default' };
    case 'fail':
      return { label: 'Fallo', variant: 'destructive' };
    case 'pending':
      return { label: 'Pendiente', variant: 'secondary' };
    default:
      return { label: 'Sin pruebas', variant: 'secondary' };
  }
}

// ── Main Page Component ────────────────────────────────────

export default function OperationalDashboardPage() {
  const navigate = useNavigate();
  const [plateSearchOpen, setPlateSearchOpen] = useState(false);
  const [plateQuery, setPlateQuery] = useState('');

  // ── Data Fetching ──────────────────────────────────────

  const {
    data: stats,
    isLoading,
    isError,
    error,
  } = useQuery<OperationalStats>({
    queryKey: ['operational-stats'],
    queryFn: () => apiClient.get<OperationalStats>('/operational-data/stats'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  // ── Merged recent activity (chronological) ─────────────

  const recentActivity = useMemo(() => {
    if (!stats?.recentActivity) return [];
    return [...stats.recentActivity].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [stats?.recentActivity]);

  // ── Plate Search Handler ───────────────────────────────

  const handlePlateSearch = () => {
    if (plateQuery.trim()) {
      navigate(`/admin/vehicles?search=${encodeURIComponent(plateQuery.trim())}`);
      setPlateSearchOpen(false);
      setPlateQuery('');
    }
  };

  // ── Siren result badge ─────────────────────────────────

  const sirenBadge = stats
    ? sirenResultLabel(stats.sirenTests.lastResult)
    : null;

  // ── Render ─────────────────────────────────────────────

  return (
    <PageShell
      title="Panel Operativo"
      description="Resumen operativo de todas las sedes"
      icon={<LayoutDashboard className="h-5 w-5" />}
    >
      <div className="p-6 space-y-8">
        {/* ── Error State ──────────────────────────────── */}
        {isError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Error al cargar datos</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {error instanceof Error ? error.message : 'No se pudieron obtener las estadisticas operativas.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Stats Cards Grid ─────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Modulos Operativos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
            ) : stats ? (
              <>
                <StatCard
                  title="Residentes"
                  icon={<Users className="h-5 w-5" />}
                  value={(stats?.residents?.total || 0).toLocaleString('es-CO')}
                  subtitle={`${(stats?.residents?.active || 0).toLocaleString('es-CO')} activos`}
                  badge={{ label: `${Math.round((stats.residents.active / Math.max(stats.residents.total, 1)) * 100)}%`, variant: 'default' }}
                  href="/admin/residents"
                />
                <StatCard
                  title="Vehiculos"
                  icon={<Car className="h-5 w-5" />}
                  value={(stats?.vehicles?.total || 0).toLocaleString('es-CO')}
                  subtitle="Placas registradas"
                  href="/admin/vehicles"
                />
                <StatCard
                  title="Biometricos"
                  icon={<Fingerprint className="h-5 w-5" />}
                  value={(stats?.biometric?.total || 0).toLocaleString('es-CO')}
                  subtitle={`Cobertura: ${stats.biometric.coveragePercent}%`}
                  badge={{
                    label: `${stats.biometric.coveragePercent}%`,
                    variant: stats.biometric.coveragePercent >= 80 ? 'default' : stats.biometric.coveragePercent >= 50 ? 'secondary' : 'destructive',
                  }}
                  href="/admin/biometric"
                />
                <StatCard
                  title="Consignas"
                  icon={<ClipboardList className="h-5 w-5" />}
                  value={stats.consignas.active}
                  subtitle="Consignas activas"
                  badge={{ label: 'Activas', variant: 'default' }}
                  href="/admin/consignas"
                />
                <StatCard
                  title="Pruebas de Sirena"
                  icon={<Siren className="h-5 w-5" />}
                  value={stats.sirenTests.totalTests}
                  subtitle={`Ultima: ${formatDate(stats.sirenTests.lastTestDate)}`}
                  badge={sirenBadge ? { label: sirenBadge.label, variant: sirenBadge.variant } : undefined}
                  href="/admin/siren-tests"
                />
                <StatCard
                  title="Reinicios"
                  icon={<RotateCcw className="h-5 w-5" />}
                  value={stats.restarts.totalRestarts}
                  subtitle={`Ultimo: ${formatDate(stats.restarts.lastDate)}`}
                  href="/admin/restarts"
                />
                <StatCard
                  title="Puertas / IoT"
                  icon={<DoorOpen className="h-5 w-5" />}
                  value={stats.doors.totalDoors}
                  subtitle={`${stats.doors.ewelinkCount} eWeLink`}
                  badge={{ label: 'IoT', variant: 'secondary' }}
                  href="/admin/door-inventory"
                />
                <StatCard
                  title="Camaras"
                  icon={<Video className="h-5 w-5" />}
                  value={stats.cameras.totalStreams}
                  subtitle={`${stats.cameras.online} en linea`}
                  badge={{
                    label: `${stats.cameras.online}/${stats.cameras.totalStreams}`,
                    variant: stats.cameras.online >= stats.cameras.totalStreams * 0.9 ? 'default' : 'destructive',
                  }}
                  href="/go2rtc"
                  external
                />
              </>
            ) : null}
          </div>
        </section>

        {/* ── Quick Actions ────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Acciones Rapidas</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => navigate('/admin/siren-tests?action=new')}
              className="gap-2"
            >
              <Siren className="h-4 w-4" />
              Registrar Prueba Sirena
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/restarts?action=new')}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Registrar Reinicio
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/consignas?action=new')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Consigna
            </Button>
            <Button
              variant="outline"
              onClick={() => setPlateSearchOpen(true)}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Buscar Placa
            </Button>
          </div>
        </section>

        {/* ── Recent Activity ──────────────────────────── */}
        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Actividad Reciente</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Ultimas pruebas de sirena y reinicios
                </p>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 py-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="divide-y">
                  {recentActivity.map((entry) => (
                    <ActivityItem key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin actividad reciente registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ── Plate Search Dialog ─────────────────────────── */}
      <Dialog open={plateSearchOpen} onOpenChange={setPlateSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar por Placa</DialogTitle>
            <DialogDescription>
              Ingrese la placa del vehiculo para consultar su registro
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Ej: ABC123"
              value={plateQuery}
              onChange={(e) => setPlateQuery(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePlateSearch();
              }}
              className="uppercase"
              autoFocus
            />
            <Button onClick={handlePlateSearch} disabled={!plateQuery.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
