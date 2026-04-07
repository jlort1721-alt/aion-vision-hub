import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useI18n } from '@/contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Video, Wifi, WifiOff, Search, Activity, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

interface Camera {
  id: string;
  name: string;
  site_id?: string;
  site_name?: string;
  site?: string;
  status?: string;
  is_online?: boolean;
  last_seen?: string;
  brand?: string;
  model?: string;
  ip_address?: string;
  channel?: number;
}

interface PaginatedResp {
  items?: Camera[];
  data?: Camera[];
  meta?: { total?: number };
}

// ── Component ────────────────────────────────────────────────

export default function CameraHealthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');

  // Fetch cameras
  const { data: cameras = [], isLoading, refetch } = useQuery({
    queryKey: ['camera-health-cameras'],
    queryFn: async () => {
      const resp = await apiClient.get<Camera[] | PaginatedResp>('/cameras', { limit: '500' });
      if (Array.isArray(resp)) return resp;
      return resp?.items ?? resp?.data ?? [];
    },
    refetchInterval: 30_000,
  });

  // Derive status for each camera
  const camerasWithStatus = useMemo(() => {
    return (cameras as Camera[]).map((cam) => ({
      ...cam,
      online: cam.is_online ?? cam.status === 'online' ?? true,
      siteName: cam.site_name ?? cam.site ?? 'Sin sitio',
    }));
  }, [cameras]);

  // Unique sites
  const sites = useMemo(() => {
    const s = new Set(camerasWithStatus.map((c) => c.siteName));
    return Array.from(s).sort();
  }, [camerasWithStatus]);

  // Filtered list
  const filtered = useMemo(() => {
    return camerasWithStatus.filter((cam) => {
      if (statusFilter === 'online' && !cam.online) return false;
      if (statusFilter === 'offline' && cam.online) return false;
      if (siteFilter !== 'all' && cam.siteName !== siteFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          cam.name?.toLowerCase().includes(q) ||
          cam.ip_address?.toLowerCase().includes(q) ||
          cam.brand?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [camerasWithStatus, statusFilter, siteFilter, search]);

  // Grouped by site
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const cam of filtered) {
      const key = cam.siteName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cam);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Stats
  const totalCameras = camerasWithStatus.length;
  const onlineCount = camerasWithStatus.filter((c) => c.online).length;
  const offlineCount = totalCameras - onlineCount;
  const uptimePercent = totalCameras > 0 ? ((onlineCount / totalCameras) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {t('nav.cameraHealth') || 'Salud de Cámaras'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('cameraHealth.subtitle') || 'Monitoreo de salud de cámaras en tiempo real'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {t('common.refresh') || 'Actualizar'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title={t('cameraHealth.total') || 'Total Cámaras'}
          value={totalCameras}
          icon={<Video className="h-4 w-4" />}
          color="text-primary"
        />
        <SummaryCard
          title={t('common.online') || 'En línea'}
          value={onlineCount}
          icon={<Wifi className="h-4 w-4" />}
          color="text-success"
          badge="success"
        />
        <SummaryCard
          title={t('common.offline') || 'Fuera de línea'}
          value={offlineCount}
          icon={<WifiOff className="h-4 w-4" />}
          color="text-destructive"
          badge="destructive"
        />
        <SummaryCard
          title={t('cameraHealth.uptime') || 'Disponibilidad'}
          value={`${uptimePercent}%`}
          icon={<Activity className="h-4 w-4" />}
          color={Number(uptimePercent) >= 95 ? 'text-success' : Number(uptimePercent) >= 80 ? 'text-warning' : 'text-destructive'}
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('cameraHealth.search') || 'Buscar por nombre, IP, marca...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('events.site') || 'Sitio'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all') || 'Todos'}</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('common.status') || 'Estado'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all') || 'Todos'}</SelectItem>
            <SelectItem value="online">{t('common.online') || 'En línea'}</SelectItem>
            <SelectItem value="offline">{t('common.offline') || 'Fuera de línea'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="ml-3 text-sm text-muted-foreground">{t('common.loading') || 'Cargando...'}</span>
        </div>
      )}

      {/* Camera Grid grouped by site */}
      {!isLoading && grouped.length === 0 && (
        <div className="text-center py-12">
          <Video className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('common.no_data') || 'Sin cámaras encontradas'}</p>
        </div>
      )}

      {!isLoading && grouped.map(([site, cams]) => (
        <div key={site}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">{site}</h2>
            <Badge variant="outline" className="text-[10px]">{cams.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
            {cams.map((cam) => (
              <Card
                key={cam.id}
                className="border border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/live-view?camera=${cam.id}`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{cam.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {cam.brand || 'Desconocido'} {cam.model ? `- ${cam.model}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                        cam.online ? 'bg-success' : 'bg-destructive animate-pulse',
                      )}
                      title={cam.online ? 'En línea' : 'Fuera de línea'}
                    />
                  </div>
                  {cam.ip_address && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">{cam.ip_address}</p>
                  )}
                  {cam.last_seen && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t('cameraHealth.lastSeen') || 'Última vez visto'}: {new Date(cam.last_seen).toLocaleString('es-CO')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  icon,
  color,
  badge,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  badge?: 'success' | 'destructive';
}) {
  return (
    <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <span className={color}>{icon}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={cn('text-2xl font-bold', color)}>{value}</span>
          {badge && (
            <Badge variant={badge === 'success' ? 'outline' : 'destructive'} className={cn('text-[10px]', badge === 'success' && 'border-success/40 text-success')}>
              {badge === 'success' ? 'OK' : 'DOWN'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
