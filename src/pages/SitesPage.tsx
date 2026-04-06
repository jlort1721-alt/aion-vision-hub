import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { useSites, useDevices } from '@/hooks/use-api-data';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MapPin, CheckCircle2, AlertCircle, XCircle, Plus, MonitorSpeaker,
  Loader2, Pencil, Trash2, Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/shared/PageShell';
import ErrorState from '@/components/ui/ErrorState';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix default marker icons for leaflet in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const statusColors: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  down: '#ef4444',
  offline: '#ef4444',
  unknown: '#6b7280',
};

function createStatusIcon(status: string, isSelected: boolean) {
  const color = statusColors[status] || statusColors.unknown;
  const size = isSelected ? 18 : 12;
  const border = isSelected ? 4 : 3;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border}px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);${isSelected ? 'transform:scale(1.3);' : ''}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Pure Leaflet map component (no react-leaflet)
function SitesMap({ sites, devices, selectedSite, onSelectSite }: {
  sites: any[];
  devices: any[];
  selectedSite: string | null;
  onSelectSite: (id: string) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<any>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 3,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old cluster
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    const positions: L.LatLng[] = [];

    sites.forEach(site => {
      if (site.latitude == null || site.longitude == null) return;
      const siteDevices = devices.filter((d: any) => d.site_id === site.id);
      const online = siteDevices.filter((d: any) => d.status === 'online').length;
      const pos = L.latLng(site.latitude, site.longitude);
      positions.push(pos);

      const marker = L.marker(pos, {
        icon: createStatusIcon(site.status, selectedSite === site.id),
      });
      marker.bindPopup(`
        <div style="font-size:12px;font-family:sans-serif;">
          <strong>${site.name?.split('—')[0]?.trim()}</strong><br/>
          ${online}/${siteDevices.length} devices online<br/>
          <span style="text-transform:capitalize">${site.status}</span>
        </div>
      `);
      marker.on('click', () => onSelectSite(site.id));
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterRef.current = clusterGroup;

    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 12 });
    }
  }, [sites, devices, selectedSite, onSelectSite]);

  return <div ref={containerRef} className="h-full w-full" />;
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'healthy': return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'degraded': return <AlertCircle className="h-4 w-4 text-warning" />;
    case 'down': case 'offline': return <XCircle className="h-4 w-4 text-destructive" />;
    default: return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
  }
};

interface SiteForm {
  name: string;
  address: string;
  timezone: string;
  latitude: string;
  longitude: string;
  status: string;
}

const defaultForm: SiteForm = {
  name: '', address: '', timezone: 'UTC', latitude: '', longitude: '', status: 'unknown',
};

export default function SitesPage() {
  const { data: sites = [], isLoading, isError, error, refetch } = useSites();
  const { data: devices = [] } = useDevices();
  const { profile, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasAnyRole(['super_admin', 'tenant_admin']);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [form, setForm] = useState<SiteForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [deleteSiteId, setDeleteSiteId] = useState<string | null>(null);

  const geoSites = useMemo(
    () => sites.filter(s => s.latitude != null && s.longitude != null),
    [sites]
  );

  const openCreate = () => { setEditingSiteId(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = (site: any) => {
    setEditingSiteId(site.id);
    setForm({
      name: site.name, address: site.address || '', timezone: site.timezone,
      latitude: site.latitude?.toString() || '', longitude: site.longitude?.toString() || '',
      status: site.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), address: form.address.trim() || null, timezone: form.timezone,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null, status: form.status,
      };
      if (editingSiteId) {
        await apiClient.patch(`/sites/${editingSiteId}`, payload);
        toast.success('Site updated');
      } else {
        await apiClient.post('/sites', payload);
        toast.success('Site created');
      }
      queryClient.invalidateQueries({ queryKey: ['sites'] }); setDialogOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save site'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (siteId: string) => {
    try {
      await apiClient.delete(`/sites/${siteId}`);
      toast.success('Site deleted');
      if (selectedSite === siteId) setSelectedSite(null);
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete site'); }
  };

  const selected = sites.find(s => s.id === selectedSite);
  const selectedDevices = devices.filter(d => d.site_id === selectedSite);

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title="Sites"
      description={`${sites.length} locations`}
      icon={<MapPin className="h-5 w-5" />}
      actions={canManage ? <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add Site</Button> : undefined}
    >
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col", selected && "max-w-[60%]")}>

        <div className="h-64 border-b relative z-0">
          <SitesMap
            sites={geoSites}
            devices={devices}
            selectedSite={selectedSite}
            onSelectSite={setSelectedSite}
          />
        </div>

        {/* Sites grid */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sites.map(site => {
                const siteDevices = devices.filter(d => d.site_id === site.id);
                const active = siteDevices.filter(d => d.status === 'active' || d.status === 'online').length;
                const cameras = siteDevices.filter(d => d.type === 'camera').length;
                return (
                  <Card key={site.id} className={cn("cursor-pointer transition-colors hover:border-primary/50", selectedSite === site.id && "border-primary")} onClick={() => setSelectedSite(site.id)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          {statusIcon(site.status)}
                          <div>
                            <CardTitle className="text-sm">{site.name}</CardTitle>
                            {site.address && <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-2.5 w-2.5" /> {site.address}</p>}
                          </div>
                        </div>
                        <Badge variant={site.status === 'healthy' ? 'default' : site.status === 'degraded' ? 'secondary' : 'outline'} className="capitalize text-[10px]">{site.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div className="p-1.5 rounded bg-muted/50"><p className="text-sm font-bold">{siteDevices.length}</p><p className="text-[9px] text-muted-foreground">Devices</p></div>
                        <div className="p-1.5 rounded bg-muted/50"><p className="text-sm font-bold">{cameras}</p><p className="text-[9px] text-muted-foreground">Cameras</p></div>
                        <div className="p-1.5 rounded bg-muted/50"><p className="text-sm font-bold text-success">{active}</p><p className="text-[9px] text-muted-foreground">Activos</p></div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-[40%] border-l overflow-auto p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">{statusIcon(selected.status)}<h2 className="font-bold">{selected.name}</h2></div>
              {selected.address && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {selected.address}</p>}
            </div>
            {canManage && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(selected)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteSiteId(selected.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            )}
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Information</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Timezone</span><span>{selected.timezone}</span></div>
              {selected.latitude && (
                <div className="flex justify-between"><span className="text-muted-foreground">Coordinates</span><span className="flex items-center gap-1 text-xs"><Navigation className="h-3 w-3" /> {selected.latitude?.toFixed(4)}, {selected.longitude?.toFixed(4)}</span></div>
              )}
              {(selected as any).wan_ip && <div className="flex justify-between"><span className="text-muted-foreground">IP Pública (WAN)</span><span className="font-mono text-success">{(selected as any).wan_ip}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline" className="capitalize text-[10px]">{selected.status}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="text-xs">{new Date(selected.created_at).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><MonitorSpeaker className="h-3 w-3" /> Devices ({selectedDevices.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {selectedDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No devices at this site</p>
              ) : selectedDevices.map(d => (
                <div key={d.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", d.status === 'online' || d.status === 'active' ? 'bg-success' : d.status === 'offline' ? 'bg-destructive' : d.status === 'pending_configuration' ? 'bg-warning' : 'bg-muted-foreground')} />
                    <div><p className="text-xs font-medium">{d.name}</p><p className="text-[10px] text-muted-foreground">{d.brand} · {(d as any).remote_address || d.ip_address || '—'}</p></div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{d.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSiteId ? 'Edit Site' : 'Add New Site'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Main Office" /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Latitude</Label><Input value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} placeholder="40.7128" type="number" step="any" /></div>
              <div className="space-y-2"><Label>Longitude</Label><Input value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} placeholder="-74.0060" type="number" step="any" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={form.timezone} onValueChange={v => setForm(p => ({ ...p, timezone: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem><SelectItem value="America/New_York">US Eastern</SelectItem>
                    <SelectItem value="America/Chicago">US Central</SelectItem><SelectItem value="America/Los_Angeles">US Pacific</SelectItem>
                    <SelectItem value="America/Mexico_City">Mexico City</SelectItem><SelectItem value="America/Bogota">Bogotá</SelectItem>
                    <SelectItem value="America/Santiago">Santiago</SelectItem><SelectItem value="America/Sao_Paulo">São Paulo</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem><SelectItem value="Europe/Madrid">Madrid</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown</SelectItem><SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem><SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editingSiteId ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Site Confirmation ─── */}
      <AlertDialog open={!!deleteSiteId} onOpenChange={open => { if (!open) setDeleteSiteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this site? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteSiteId) {
                  handleDelete(deleteSiteId);
                  setDeleteSiteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageShell>
  );
}
