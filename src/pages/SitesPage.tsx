import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSites, useDevices } from '@/hooks/use-api-data';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MapPin, CheckCircle2, AlertCircle, XCircle, Plus, MonitorSpeaker,
  Loader2, Pencil, Trash2, Navigation, Search, Camera, Wifi, WifiOff,
  Building2, Globe, ChevronRight, X, Video, Router, Shield,
  ArrowUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/shared/PageShell';
import ErrorState from '@/components/ui/ErrorState';
import type { ApiSite, ApiDevice } from '@/types/api-entities';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix default marker icons for leaflet in bundled apps
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ══════════════════════════════════════════════════════════════
// Constants & Utilities
// ══════════════════════════════════════════════════════════════

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  healthy: { color: '#22c55e', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Operativo' },
  degraded: { color: '#f59e0b', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', label: 'Degradado' },
  down: { color: '#ef4444', bg: 'bg-red-500/10 text-red-400 border-red-500/30', label: 'Caído' },
  offline: { color: '#ef4444', bg: 'bg-red-500/10 text-red-400 border-red-500/30', label: 'Offline' },
  unknown: { color: '#6b7280', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30', label: 'Desconocido' },
};

function getStatusConfig(status: string) {
  return statusConfig[status] || statusConfig.unknown;
}

function createStatusIcon(status: string, isSelected: boolean) {
  const cfg = getStatusConfig(status);
  const size = isSelected ? 20 : 14;
  const border = isSelected ? 4 : 3;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${cfg.color};border:${border}px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);${isSelected ? 'transform:scale(1.3);z-index:999;' : ''}transition:transform 0.2s;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const StatusIcon = ({ status, className }: { status: string; className?: string }) => {
  switch (status) {
    case 'healthy': return <CheckCircle2 className={cn("h-4 w-4 text-emerald-400", className)} />;
    case 'degraded': return <AlertCircle className={cn("h-4 w-4 text-amber-400", className)} />;
    case 'down': case 'offline': return <XCircle className={cn("h-4 w-4 text-red-400", className)} />;
    default: return <CheckCircle2 className={cn("h-4 w-4 text-slate-500", className)} />;
  }
};

const DeviceTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'camera': return <Camera className="h-3.5 w-3.5 text-blue-400" />;
    case 'dvr': case 'nvr': case 'xvr': return <Video className="h-3.5 w-3.5 text-purple-400" />;
    case 'router': return <Router className="h-3.5 w-3.5 text-cyan-400" />;
    case 'access_control': return <Shield className="h-3.5 w-3.5 text-amber-400" />;
    default: return <MonitorSpeaker className="h-3.5 w-3.5 text-slate-400" />;
  }
};

// ══════════════════════════════════════════════════════════════
// Map Component
// ══════════════════════════════════════════════════════════════

function SitesMap({ sites, devices, selectedSite, onSelectSite }: {
  sites: any[];
  devices: any[];
  selectedSite: string | null;
  onSelectSite: (id: string) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [6.25, -75.57], // Medellín default
      zoom: 12,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (clusterRef.current) map.removeLayer(clusterRef.current);

    const clusterGroup = (L as unknown as Record<string, (...args: unknown[]) => L.LayerGroup>).markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: { getChildCount: () => number }) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          className: '',
          html: `<div style="width:32px;height:32px;border-radius:50%;background:rgba(212,160,23,0.9);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;border:3px solid rgba(255,255,255,0.3);box-shadow:0 2px 10px rgba(0,0,0,0.4);">${count}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
      },
    });

    const positions: L.LatLng[] = [];

    sites.forEach(site => {
      const lat = parseFloat(site.latitude);
      const lng = parseFloat(site.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const siteDevices = devices.filter((d: any) => d.site_id === site.id);
      const online = siteDevices.filter((d: any) => d.status === 'online' || d.status === 'active').length;
      const cameras = siteDevices.filter((d: any) => d.type === 'camera').length;
      const pos = L.latLng(lat, lng);
      positions.push(pos);

      const marker = L.marker(pos, {
        icon: createStatusIcon(site.status, selectedSite === site.id),
      });
      marker.bindPopup(`
        <div style="font-size:12px;font-family:system-ui;min-width:140px;">
          <strong style="color:#D4A017;">${site.name?.split('—')[0]?.trim()}</strong><br/>
          <span style="color:#94a3b8;">${site.address || 'Sin dirección'}</span><br/>
          <div style="margin-top:4px;display:flex;gap:12px;font-size:11px;">
            <span>${cameras} cámaras</span>
            <span>${online}/${siteDevices.length} online</span>
          </div>
        </div>
      `);
      marker.on('click', () => onSelectSite(site.id));
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterRef.current = clusterGroup;

    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [50, 50], maxZoom: 14 });
    }
  }, [sites, devices, selectedSite, onSelectSite]);

  return (
    <div ref={containerRef} className="h-full w-full rounded-lg" style={{ minHeight: 200 }} />
  );
}

// ══════════════════════════════════════════════════════════════
// Site Form
// ══════════════════════════════════════════════════════════════

interface SiteForm {
  name: string;
  address: string;
  timezone: string;
  latitude: string;
  longitude: string;
  status: string;
  wanIp: string;
}

const defaultForm: SiteForm = {
  name: '', address: '', timezone: 'America/Bogota', latitude: '', longitude: '', status: 'unknown', wanIp: '',
};

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function SitesPage() {
  const { data: rawSites = [], isLoading, isError, error, refetch } = useSites(30000);
  const { data: rawDevices = [] } = useDevices();
  const sites = rawSites as ApiSite[];
  const devices = rawDevices as ApiDevice[];
  const { hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasAnyRole(['super_admin', 'tenant_admin']);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [form, setForm] = useState<SiteForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'devices' | 'status'>('name');

  const geoSites = useMemo(
    () => sites.filter(s => s.latitude != null && s.longitude != null && s.latitude !== '' && s.longitude !== ''),
    [sites]
  );

  // Site metrics computed once
  const siteMetrics = useMemo(() => {
    const map = new Map<string, { total: number; online: number; cameras: number; residents: number }>();
    for (const site of sites) {
      const siteDevices = devices.filter(d => d.site_id === site.id);
      map.set(site.id, {
        total: siteDevices.length,
        online: siteDevices.filter(d => d.status === 'online' || d.status === 'active').length,
        cameras: siteDevices.filter(d => d.type === 'camera').length,
        residents: 0,
      });
    }
    return map;
  }, [sites, devices]);

  // Filtered & sorted sites
  const filteredSites = useMemo(() => {
    let result = [...sites];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.status?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'devices') {
        return (siteMetrics.get(b.id)?.total || 0) - (siteMetrics.get(a.id)?.total || 0);
      }
      if (sortBy === 'status') {
        const order = { healthy: 0, degraded: 1, offline: 2, down: 2, unknown: 3 };
        return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    return result;
  }, [sites, searchQuery, sortBy, siteMetrics]);

  // Summary stats
  const summary = useMemo(() => {
    const total = sites.length;
    const healthy = sites.filter(s => s.status === 'healthy').length;
    const degraded = sites.filter(s => s.status === 'degraded').length;
    const offline = sites.filter(s => s.status === 'offline' || s.status === 'down').length;
    const totalDevices = devices.length;
    const onlineDevices = devices.filter(d => d.status === 'online' || d.status === 'active').length;
    return { total, healthy, degraded, offline, totalDevices, onlineDevices };
  }, [sites, devices]);

  const openCreate = () => { setEditingSiteId(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = useCallback((site: any) => {
    setEditingSiteId(site.id);
    setForm({
      name: site.name || '', address: site.address || '', timezone: site.timezone || 'America/Bogota',
      latitude: site.latitude?.toString() || '', longitude: site.longitude?.toString() || '',
      status: site.status || 'unknown', wanIp: site.wanIp || site.wan_ip || '',
    });
    setDialogOpen(true);
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        timezone: form.timezone,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        status: form.status,
        wanIp: form.wanIp.trim() || null,
      };
      if (editingSiteId) {
        await apiClient.patch(`/sites/${editingSiteId}`, payload);
        toast.success('Sitio actualizado');
      } else {
        await apiClient.post('/sites', payload);
        toast.success('Sitio creado');
      }
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando sitio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (siteId: string) => {
    try {
      await apiClient.delete(`/sites/${siteId}`);
      toast.success('Sitio eliminado');
      if (selectedSite === siteId) setSelectedSite(null);
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error eliminando sitio');
    }
  };

  const selected = sites.find(s => s.id === selectedSite);
  const selectedDevices = useMemo(
    () => devices.filter(d => d.site_id === selectedSite),
    [devices, selectedSite]
  );

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title="Sitios"
      description={`${sites.length} ubicaciones monitoreadas`}
      icon={<Building2 className="h-5 w-5" />}
      actions={canManage ? <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo Sitio</Button> : undefined}
    >
    <div className="flex flex-col lg:flex-row h-full">

      {/* ── Main Column ──────────────────────────────────── */}
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", selected && "lg:max-w-[58%]")}>

        {/* Summary Stats */}
        <div className="px-4 pt-4 pb-2 flex gap-3 flex-wrap">
          <MiniStat icon={<Building2 className="h-3.5 w-3.5" />} label="Total" value={summary.total} />
          <MiniStat icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} label="Operativos" value={summary.healthy} />
          <MiniStat icon={<AlertCircle className="h-3.5 w-3.5 text-amber-400" />} label="Degradados" value={summary.degraded} />
          <MiniStat icon={<XCircle className="h-3.5 w-3.5 text-red-400" />} label="Offline" value={summary.offline} />
          <MiniStat icon={<MonitorSpeaker className="h-3.5 w-3.5 text-blue-400" />} label="Dispositivos" value={`${summary.onlineDevices}/${summary.totalDevices}`} />
        </div>

        {/* Map */}
        <div className="mx-4 h-56 lg:h-72 rounded-lg overflow-hidden border border-slate-700/50 relative">
          {geoSites.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center bg-slate-900/50 text-slate-500">
              <MapPin className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Sin coordenadas GPS</p>
              <p className="text-xs mt-1">Agrega latitud/longitud a los sitios para ver el mapa</p>
            </div>
          ) : (
            <SitesMap sites={geoSites} devices={devices} selectedSite={selectedSite} onSelectSite={setSelectedSite} />
          )}
        </div>

        {/* Search & Sort Bar */}
        <div className="px-4 pt-3 pb-2 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input
              placeholder="Buscar sitio..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-slate-900/50 border-slate-700 text-sm"
            />
          </div>
          <Select value={sortBy} onValueChange={v => setSortBy(v as 'name' | 'devices' | 'status')}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-slate-900/50 border-slate-700">
              <ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="devices">Dispositivos</SelectItem>
              <SelectItem value="status">Estado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sites Grid */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              {searchQuery ? (
                <>
                  <Search className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">No se encontraron sitios para "{searchQuery}"</p>
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="mt-2 text-xs">Limpiar filtro</Button>
                </>
              ) : (
                <>
                  <Building2 className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">No hay sitios registrados</p>
                  {canManage && <Button size="sm" onClick={openCreate} className="mt-3 gap-1"><Plus className="h-3.5 w-3.5" /> Crear primer sitio</Button>}
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredSites.map(site => {
                const m = siteMetrics.get(site.id) || { total: 0, online: 0, cameras: 0, residents: 0 };
                const cfg = getStatusConfig(site.status);
                const isSelected = selectedSite === site.id;
                return (
                  <Card
                    key={site.id}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:border-slate-600 group",
                      isSelected ? "border-[#D4A017] bg-slate-800/80 shadow-lg shadow-amber-900/10" : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60"
                    )}
                    onClick={() => setSelectedSite(isSelected ? null : site.id)}
                  >
                    <CardContent className="p-3.5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <StatusIcon status={site.status} className="mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">{site.name}</h3>
                            {site.address && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="h-2.5 w-2.5 shrink-0" /> {site.address}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge className={cn("text-[9px] shrink-0 border", cfg.bg)}>{cfg.label}</Badge>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <MetricCell icon={<MonitorSpeaker className="h-3 w-3" />} value={m.total} label="Dispositivos" />
                        <MetricCell icon={<Camera className="h-3 w-3 text-blue-400" />} value={m.cameras} label="Cámaras" />
                        <MetricCell
                          icon={m.online > 0 ? <Wifi className="h-3 w-3 text-emerald-400" /> : <WifiOff className="h-3 w-3 text-red-400" />}
                          value={`${m.online}/${m.total}`}
                          label="Online"
                          highlight={m.online === m.total && m.total > 0}
                        />
                      </div>

                      {/* Expand indicator */}
                      {isSelected && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-center">
                          <ChevronRight className="h-3.5 w-3.5 text-[#D4A017] animate-pulse" />
                          <span className="text-[10px] text-[#D4A017] ml-1">Ver detalle</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Panel ─────────────────────────────────── */}
      {selected && (
        <div className="lg:w-[42%] border-t lg:border-t-0 lg:border-l border-slate-700/50 overflow-auto bg-slate-900/30">
          <DetailPanel
            site={selected}
            devices={selectedDevices}
            canManage={canManage}
            onEdit={() => openEdit(selected)}
            onDelete={() => setDeleteSiteId(selected.id)}
            onClose={() => setSelectedSite(null)}
          />
        </div>
      )}

      {/* ── Create/Edit Dialog ───────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSiteId ? 'Editar Sitio' : 'Nuevo Sitio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Nombre *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Altagracia" className="bg-slate-900 border-slate-700" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Dirección</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Carrera 39 #48-19, Medellín" className="bg-slate-900 border-slate-700" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Latitud</Label>
                <Input value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} placeholder="6.2518" type="number" step="any" className="bg-slate-900 border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Longitud</Label>
                <Input value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} placeholder="-75.5636" type="number" step="any" className="bg-slate-900 border-slate-700" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Zona horaria</Label>
                <Select value={form.timezone} onValueChange={v => setForm(p => ({ ...p, timezone: v }))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Bogota">Bogotá (COT)</SelectItem>
                    <SelectItem value="America/Mexico_City">Ciudad de México</SelectItem>
                    <SelectItem value="America/New_York">New York (EST)</SelectItem>
                    <SelectItem value="America/Sao_Paulo">São Paulo (BRT)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="healthy">Operativo</SelectItem>
                    <SelectItem value="degraded">Degradado</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="unknown">Desconocido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">IP Pública (WAN)</Label>
              <Input value={form.wanIp} onChange={e => setForm(p => ({ ...p, wanIp: e.target.value }))} placeholder="190.xxx.xxx.xxx" className="bg-slate-900 border-slate-700 font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingSiteId ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────── */}
      <AlertDialog open={!!deleteSiteId} onOpenChange={open => { if (!open) setDeleteSiteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Sitio</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el sitio y todos sus dispositivos asociados. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteSiteId) { handleDelete(deleteSiteId); setDeleteSiteId(null); } }}
            >
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

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/50 border border-slate-700/30">
      {icon}
      <span className="text-xs font-semibold text-white">{value}</span>
      <span className="text-[10px] text-slate-500 hidden sm:inline">{label}</span>
    </div>
  );
}

function MetricCell({ icon, value, label, highlight }: { icon: React.ReactNode; value: string | number; label: string; highlight?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center py-1.5 rounded-md", highlight ? "bg-emerald-900/20" : "bg-slate-900/40")}>
      {icon}
      <p className="text-xs font-bold text-white mt-0.5">{value}</p>
      <p className="text-[8px] text-slate-500">{label}</p>
    </div>
  );
}

function DetailPanel({ site, devices, canManage, onEdit, onDelete, onClose }: {
  site: any;
  devices: any[];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const cfg = getStatusConfig(site.status);
  const online = devices.filter(d => d.status === 'online' || d.status === 'active').length;
  const cameras = devices.filter(d => d.type === 'camera').length;
  const [deviceFilter, setDeviceFilter] = useState('');

  // Group devices by type
  const devicesByType = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const d of devices) {
      const type = d.type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(d);
    }
    return groups;
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (!deviceFilter) return devices;
    const q = deviceFilter.toLowerCase();
    return devices.filter(d =>
      d.name?.toLowerCase().includes(q) ||
      d.ip_address?.toLowerCase().includes(q) ||
      d.type?.toLowerCase().includes(q)
    );
  }, [devices, deviceFilter]);

  const wanIp = site.wanIp || site.wan_ip;
  const lat = parseFloat(site.latitude);
  const lng = parseFloat(site.longitude);
  const hasCoords = !isNaN(lat) && !isNaN(lng);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <StatusIcon status={site.status} className="h-5 w-5 mt-0.5" />
          <div className="min-w-0">
            <h2 className="font-bold text-white text-lg leading-tight">{site.name}</h2>
            {site.address && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 shrink-0" /> {site.address}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canManage && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Status + Quick Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center p-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
          <Badge className={cn("text-[9px] border mb-1", cfg.bg)}>{cfg.label}</Badge>
          <p className="text-[9px] text-slate-500">Estado</p>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
          <p className="text-sm font-bold text-white">{devices.length}</p>
          <p className="text-[9px] text-slate-500">Dispositivos</p>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
          <p className="text-sm font-bold text-blue-400">{cameras}</p>
          <p className="text-[9px] text-slate-500">Cámaras</p>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
          <p className={cn("text-sm font-bold", online === devices.length && devices.length > 0 ? "text-emerald-400" : "text-amber-400")}>{online}/{devices.length}</p>
          <p className="text-[9px] text-slate-500">Online</p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-slate-800/30 border-slate-700/40">
        <CardContent className="p-3 space-y-2 text-sm">
          <InfoRow label="Zona horaria" value={<span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {site.timezone}</span>} />
          {hasCoords && (
            <InfoRow label="Coordenadas" value={
              <span className="flex items-center gap-1 font-mono text-xs">
                <Navigation className="h-3 w-3 text-[#D4A017]" /> {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            } />
          )}
          {wanIp && <InfoRow label="IP Pública" value={<span className="font-mono text-emerald-400 text-xs">{wanIp}</span>} />}
          <InfoRow label="Creado" value={new Date(site.created_at || site.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })} />
          {site.updated_at && site.updated_at !== site.created_at && (
            <InfoRow label="Actualizado" value={new Date(site.updated_at || site.updatedAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })} />
          )}
        </CardContent>
      </Card>

      {/* Devices */}
      <Card className="bg-slate-800/30 border-slate-700/40">
        <CardHeader className="pb-2 px-3 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <MonitorSpeaker className="h-4 w-4 text-blue-400" />
              Dispositivos ({devices.length})
            </CardTitle>
            {devices.length > 5 && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                <Input
                  placeholder="Filtrar..."
                  value={deviceFilter}
                  onChange={e => setDeviceFilter(e.target.value)}
                  className="pl-7 h-7 w-32 text-xs bg-slate-900/50 border-slate-700"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {devices.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <MonitorSpeaker className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Sin dispositivos en este sitio</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {filteredDevices.map(d => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-2 rounded-md bg-slate-900/40 hover:bg-slate-900/60 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      d.status === 'online' || d.status === 'active' ? 'bg-emerald-400' :
                      d.status === 'offline' ? 'bg-red-400' :
                      d.status === 'pending_configuration' ? 'bg-amber-400' : 'bg-slate-500'
                    )} />
                    <DeviceTypeIcon type={d.type} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{d.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {d.brand && `${d.brand} `}{d.model && `${d.model} · `}{d.remote_address || d.ip_address || ''}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] capitalize shrink-0",
                      d.status === 'online' || d.status === 'active' ? 'text-emerald-400 border-emerald-800' :
                      d.status === 'offline' ? 'text-red-400 border-red-800' : 'text-slate-400 border-slate-700'
                    )}
                  >
                    {d.status}
                  </Badge>
                </div>
              ))}
              {deviceFilter && filteredDevices.length === 0 && (
                <p className="text-center text-xs text-slate-500 py-3">Sin resultados para "{deviceFilter}"</p>
              )}
            </div>
          )}

          {/* Device type summary */}
          {Object.keys(devicesByType).length > 1 && (
            <div className="mt-3 pt-2 border-t border-slate-700/30 flex flex-wrap gap-2">
              {Object.entries(devicesByType).map(([type, devs]) => (
                <div key={type} className="flex items-center gap-1 text-[10px] text-slate-400">
                  <DeviceTypeIcon type={type} />
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                  <span className="text-slate-500">({devs.length})</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-white text-xs">{value}</span>
    </div>
  );
}
