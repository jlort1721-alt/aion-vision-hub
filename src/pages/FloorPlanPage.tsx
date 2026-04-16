import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSites, useDevices } from '@/hooks/use-api-data';
import { apiClient } from '@/lib/api-client';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import { Map, Camera, DoorOpen, Siren, Radio, Loader2 } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ApiDevice, ApiSite, FloorPlanPosition } from '@/types/api-entities';

/** Extended Leaflet Map with custom AION property */
interface AionLeafletMap extends L.Map {
  _aionImageLayer?: L.ImageOverlay;
}

// ── Device type config ──────────────────────────────────────
const DEVICE_STYLES: Record<string, { color: string; label: string; icon: string }> = {
  camera: { color: '#3b82f6', label: 'Camera', icon: '📷' },
  door: { color: '#22c55e', label: 'Door', icon: '🚪' },
  siren: { color: '#ef4444', label: 'Siren', icon: '🔴' },
  sensor: { color: '#eab308', label: 'Sensor', icon: '📡' },
  access_point: { color: '#22c55e', label: 'Access Point', icon: '🚪' },
  alarm: { color: '#ef4444', label: 'Alarm', icon: '🔴' },
  intercom: { color: '#a855f7', label: 'Intercom', icon: '📞' },
};

function getDeviceStyle(type: string) {
  const normalized = type?.toLowerCase().replace(/\s+/g, '_') || '';
  if (normalized.includes('camera') || normalized.includes('nvr') || normalized.includes('dvr')) return DEVICE_STYLES.camera;
  if (normalized.includes('door') || normalized.includes('access') || normalized.includes('lock')) return DEVICE_STYLES.door;
  if (normalized.includes('siren') || normalized.includes('alarm') || normalized.includes('horn')) return DEVICE_STYLES.siren;
  if (normalized.includes('sensor') || normalized.includes('detector') || normalized.includes('pir')) return DEVICE_STYLES.sensor;
  if (normalized.includes('intercom') || normalized.includes('phone')) return DEVICE_STYLES.intercom;
  return DEVICE_STYLES.sensor;
}

function createDeviceIcon(type: string, status: string) {
  const style = getDeviceStyle(type);
  const isOnline = status === 'online' || status === 'active';
  const ring = isOnline ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.5)';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:32px;height:32px;border-radius:50%;
        background:${style.color};
        border:3px solid ${ring};
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;cursor:pointer;
        transition:transform 0.15s;
      " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">${style.icon}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// ── Generate floor plan SVG tailored to the site ────────────
function generateFloorPlanSVG(siteName: string, deviceCount: number, address?: string): string {
  // Residential complex zones relevant to security monitoring
  const zones = [
    { x: 40, y: 40, w: 280, h: 180, label: 'Porteria Principal' },
    { x: 320, y: 40, w: 280, h: 180, label: 'Acceso Vehicular' },
    { x: 600, y: 40, w: 280, h: 180, label: 'Parqueaderos Norte' },
    { x: 880, y: 40, w: 280, h: 180, label: 'Zona Verde' },
    { x: 40, y: 220, w: 560, h: 180, label: 'Área Social / Salón Comunal' },
    { x: 600, y: 220, w: 560, h: 180, label: 'Centro de Monitoreo' },
    { x: 40, y: 400, w: 280, h: 180, label: 'Torre / Bloque A' },
    { x: 320, y: 400, w: 280, h: 180, label: 'Torre / Bloque B' },
    { x: 600, y: 400, w: 560, h: 180, label: 'Parqueaderos Sur' },
    { x: 40, y: 580, w: 370, h: 180, label: 'Lobby / Recepción' },
    { x: 410, y: 580, w: 370, h: 180, label: 'Cuarto de Equipos' },
    { x: 780, y: 580, w: 380, h: 180, label: 'Depósito / Basuras' },
  ];

  const zonesSvg = zones.map(z =>
    `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="none" stroke="rgba(100,160,255,0.3)" stroke-width="1.5"/>
     <text x="${z.x + z.w / 2}" y="${z.y + z.h / 2 + 4}" fill="rgba(100,160,255,0.45)" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif">${z.label}</text>`
  ).join('\n');

  // Door indicators between zones
  const doors = [
    { x: 155, y: 216 }, { x: 435, y: 216 }, { x: 715, y: 216 }, { x: 995, y: 216 },
    { x: 285, y: 577 }, { x: 565, y: 577 }, { x: 155, y: 396 }, { x: 435, y: 396 },
  ];
  const doorsSvg = doors.map(d =>
    `<rect x="${d.x}" y="${d.y}" width="50" height="7" fill="rgba(34,197,94,0.35)" rx="2"/>`
  ).join('\n');

  const escapedName = siteName.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const escapedAddr = (address || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(100,140,200,0.12)" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect width="1200" height="800" fill="#0d1321"/>
      <rect width="1200" height="800" fill="url(#grid)"/>
      <!-- Site title -->
      <text x="600" y="25" fill="rgba(100,180,255,0.7)" text-anchor="middle" font-size="15" font-weight="600" font-family="system-ui,sans-serif">${escapedName}</text>
      <text x="600" y="790" fill="rgba(100,160,255,0.3)" text-anchor="middle" font-size="9" font-family="system-ui,sans-serif">${escapedAddr} — ${deviceCount} dispositivos</text>
      <!-- Outer walls -->
      <rect x="40" y="40" width="1120" height="720" fill="none" stroke="rgba(100,160,255,0.4)" stroke-width="3" rx="4"/>
      <!-- Corridors -->
      <line x1="40" y1="400" x2="1160" y2="400" stroke="rgba(100,160,255,0.2)" stroke-width="1.5" stroke-dasharray="8,4"/>
      <line x1="600" y1="40" x2="600" y2="760" stroke="rgba(100,160,255,0.2)" stroke-width="1.5" stroke-dasharray="8,4"/>
      <!-- Zones -->
      ${zonesSvg}
      <!-- Doors -->
      ${doorsSvg}
    </svg>
  `;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// ── Default device positions on the grid ────────────────────
function generateDefaultPositions(devices: ApiDevice[]): FloorPlanPosition[] {
  // Predefined positions spread across the floor plan
  const slots = [
    // Top row rooms
    { x: 180, y: 100 }, { x: 460, y: 100 }, { x: 740, y: 100 }, { x: 1020, y: 100 },
    // Middle area
    { x: 150, y: 310 }, { x: 400, y: 310 }, { x: 700, y: 310 }, { x: 950, y: 310 },
    // Corridors
    { x: 300, y: 400 }, { x: 600, y: 400 }, { x: 900, y: 400 },
    // Bottom left rooms
    { x: 180, y: 490 }, { x: 460, y: 490 }, { x: 880, y: 490 },
    // Bottom row
    { x: 225, y: 670 }, { x: 595, y: 670 }, { x: 970, y: 670 },
    // Extra positions
    { x: 80, y: 200 }, { x: 560, y: 200 }, { x: 1100, y: 200 },
    { x: 80, y: 600 }, { x: 1100, y: 600 }, { x: 300, y: 700 }, { x: 800, y: 700 },
  ];

  return devices.map((device, i) => ({
    deviceId: device.id,
    x: slots[i % slots.length].x,
    y: slots[i % slots.length].y,
  }));
}

// ── Floor Plan Map Component ────────────────────────────────
function FloorPlanMap({
  devices,
  positions,
  onDeviceAction,
  onPositionChange,
  siteName,
  siteAddress,
}: {
  devices: ApiDevice[];
  positions: FloorPlanPosition[];
  onDeviceAction: (deviceId: string, action: string) => void;
  onPositionChange?: (deviceId: string, x: number, y: number) => void;
  siteName?: string;
  siteAddress?: string;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const { t } = useI18n();

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const bounds: L.LatLngBoundsExpression = [[0, 0], [800, 1200]];
    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      attributionControl: false,
    });

    const imageUrl = generateFloorPlanSVG('', 0);
    const imageLayer = L.imageOverlay(imageUrl, bounds).addTo(map);
    (map as AionLeafletMap)._aionImageLayer = imageLayer;
    map.fitBounds(bounds);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Update SVG overlay when site info changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds: L.LatLngBoundsExpression = [[0, 0], [800, 1200]];
    const oldLayer = (map as AionLeafletMap)._aionImageLayer;
    if (oldLayer) map.removeLayer(oldLayer);
    const newUrl = generateFloorPlanSVG(siteName || '', devices.length, siteAddress);
    const newLayer = L.imageOverlay(newUrl, bounds).addTo(map);
    newLayer.bringToBack();
    (map as AionLeafletMap)._aionImageLayer = newLayer;
  }, [siteName, siteAddress, devices.length]);

  // Update markers when devices/positions change
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    positions.forEach((pos) => {
      const device = devices.find((d) => d.id === pos.deviceId);
      if (!device) return;

      const style = getDeviceStyle(device.type);
      const isOnline = device.status === 'online' || device.status === 'active';
      const statusText = isOnline ? 'Online' : 'Offline';
      const statusColor = isOnline ? '#22c55e' : '#ef4444';

      // Leaflet CRS.Simple: [y, x] where y is inverted for image overlay
      const latLng = L.latLng(800 - pos.y, pos.x);
      const marker = L.marker(latLng, {
        icon: createDeviceIcon(device.type, device.status),
        draggable: true,
      });

      // Persist position on drag end
      marker.on('dragend', () => {
        const newPos = marker.getLatLng();
        const newX = Math.round(newPos.lng);
        const newY = Math.round(800 - newPos.lat);
        onPositionChange?.(pos.deviceId, newX, newY);
      });

      // Build popup content based on device type
      let actionButton = '';
      const deviceType = device.type?.toLowerCase() || '';

      if (deviceType.includes('camera') || deviceType.includes('nvr') || deviceType.includes('dvr')) {
        actionButton = `<button onclick="window.__floorPlanAction__('${device.id}','view_live')" style="
          width:100%;margin-top:8px;padding:6px 12px;border:none;border-radius:6px;
          background:#3b82f6;color:white;font-size:12px;font-weight:500;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:4px;
        ">&#128065; ${t('floorPlan.viewLive') || 'View Live'}</button>`;
      } else if (deviceType.includes('door') || deviceType.includes('access') || deviceType.includes('lock')) {
        actionButton = `<button onclick="window.__floorPlanAction__('${device.id}','open_door')" style="
          width:100%;margin-top:8px;padding:6px 12px;border:none;border-radius:6px;
          background:#22c55e;color:white;font-size:12px;font-weight:500;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:4px;
        ">&#128682; ${t('floorPlan.openDoor') || 'Open Door'}</button>`;
      } else if (deviceType.includes('siren') || deviceType.includes('alarm') || deviceType.includes('horn')) {
        actionButton = `<button onclick="window.__floorPlanAction__('${device.id}','activate_siren')" style="
          width:100%;margin-top:8px;padding:6px 12px;border:none;border-radius:6px;
          background:#ef4444;color:white;font-size:12px;font-weight:500;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:4px;
        ">&#128264; ${t('floorPlan.activateSiren') || 'Activate Siren'}</button>`;
      }

      const popupContent = `
        <div style="font-family:system-ui,sans-serif;min-width:180px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="font-size:16px;">${style.icon}</span>
            <strong style="font-size:13px;">${device.name}</strong>
          </div>
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};display:inline-block;"></span>
            <span style="font-size:11px;color:${statusColor};font-weight:500;">${statusText}</span>
          </div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:2px;">${device.brand || ''} ${device.model || ''}</div>
          <div style="font-size:11px;color:#6b7280;">${device.ip_address || device.remote_address || ''}</div>
          ${actionButton}
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'floor-plan-popup',
        maxWidth: 250,
      });

      markersLayer.addLayer(marker);
    });
  }, [devices, positions, t]);

  // Register global action handler
  useEffect(() => {
    const win = window as Window & { __floorPlanAction__?: (deviceId: string, action: string) => void };
    win.__floorPlanAction__ = (deviceId: string, action: string) => {
      onDeviceAction(deviceId, action);
    };
    return () => {
      delete win.__floorPlanAction__;
    };
  }, [onDeviceAction]);

  return <div ref={containerRef} className="h-full w-full" />;
}

// ── Main Page Component ─────────────────────────────────────
export default function FloorPlanPage() {
  const { t } = useI18n();
  const { data: sites = [], isLoading: sitesLoading } = useSites();
  const { data: allDevices = [] } = useDevices();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [positions, setPositions] = useState<FloorPlanPosition[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const selectedSite = useMemo(() => sites.find((s) => s.id === selectedSiteId), [sites, selectedSiteId]);

  // Auto-select first site
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(String(sites[0].id));
    }
  }, [sites, selectedSiteId]);

  // Devices for selected site
  const siteDevices = useMemo(
    () => allDevices.filter((d) => d.site_id === selectedSiteId),
    [allDevices, selectedSiteId]
  );

  // Fetch floor plan positions when site changes
  useEffect(() => {
    if (!selectedSiteId) {
      setPositions([]);
      return;
    }

    let cancelled = false;
    setLoadingPlan(true);

    (async () => {
      // Try localStorage cache first for instant display
      try {
        const saved = localStorage.getItem(`aion-fp-${selectedSiteId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (!cancelled) { setPositions(parsed); setLoadingPlan(false); }
          }
        }
      } catch { /* ignore */ }

      // Fetch from backend (floor-plans positions API)
      try {
        const data = await apiClient.get<FloorPlanPosition[]>(`/floor-plans/${selectedSiteId}/positions`);
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((p: any) => ({
            deviceId: p.deviceId,
            x: Number(p.x),
            y: Number(p.y),
          }));
          setPositions(mapped);
          try { localStorage.setItem(`aion-fp-${selectedSiteId}`, JSON.stringify(mapped)); } catch { /* */ }
        } else if (!cancelled) {
          // Fallback to default positions if no saved positions
          const cachedPositions = localStorage.getItem(`aion-fp-${selectedSiteId}`);
          if (!cachedPositions) {
            setPositions(generateDefaultPositions(siteDevices));
          }
        }
      } catch {
        if (!cancelled) {
          // API not available — use defaults if no localStorage cache
          const cachedPositions = localStorage.getItem(`aion-fp-${selectedSiteId}`);
          if (!cachedPositions) {
            setPositions(generateDefaultPositions(siteDevices));
          }
        }
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedSiteId, siteDevices]);

  // Device action handler
  const handleDeviceAction = useCallback((deviceId: string, action: string) => {
    const device = allDevices.find((d) => d.id === deviceId);
    if (!device) return;

    switch (action) {
      case 'view_live':
        // Navigate to live view or open stream
        window.open(`/live-view?device=${deviceId}`, '_blank');
        toast.success(`${t('floorPlan.openingStream') || 'Opening live stream'}: ${device.name}`);
        break;
      case 'open_door':
        toast.info(`${t('floorPlan.doorCommand') || 'Door open command sent'}: ${device.name}`);
        apiClient.post(`/devices/${deviceId}/actions`, { action: 'open_door' }).catch(() => {
          toast.error(t('floorPlan.actionFailed') || 'Action failed');
        });
        break;
      case 'activate_siren':
        toast.warning(`${t('floorPlan.sirenActivated') || 'Siren activated'}: ${device.name}`);
        apiClient.post(`/devices/${deviceId}/actions`, { action: 'activate_siren' }).catch(() => {
          toast.error(t('floorPlan.actionFailed') || 'Action failed');
        });
        break;
    }
  }, [allDevices, t]);

  // Stats for selected site
  const stats = useMemo(() => {
    const cameras = siteDevices.filter((d) => {
      const type = String(d.type ?? '').toLowerCase();
      return type.includes('camera') || type.includes('nvr') || type.includes('dvr');
    }).length;
    const doors = siteDevices.filter((d) => {
      const type = String(d.type ?? '').toLowerCase();
      return type.includes('door') || type.includes('access') || type.includes('lock');
    }).length;
    const sirens = siteDevices.filter((d) => {
      const type = String(d.type ?? '').toLowerCase();
      return type.includes('siren') || type.includes('alarm') || type.includes('horn');
    }).length;
    const sensors = siteDevices.length - cameras - doors - sirens;
    const online = siteDevices.filter((d) => d.status === 'online' || d.status === 'active').length;
    return { cameras, doors, sirens, sensors, online, total: siteDevices.length };
  }, [siteDevices]);

  if (sitesLoading) {
    return (
      <PageShell title={t('floorPlan.title') || 'Floor Plan'} icon={<Map className="h-5 w-5" />}>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t('floorPlan.title') || 'Floor Plan'}
      description={t('floorPlan.subtitle') || 'Interactive site map with device locations'}
      icon={<Map className="h-5 w-5" />}
    >
      <div className="flex flex-col h-full">
        {/* ── Header bar ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b bg-[#0a0e1a]/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              {t('floorPlan.selectSite') || 'Site'}:
            </label>
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="w-[240px] bg-[#111827] border-[#1e293b]">
                <SelectValue placeholder={t('floorPlan.chooseSite') || 'Select a site...'} />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={String(site.id)} value={String(site.id)}>
                    {String(site.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSiteId && (
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Camera className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-medium text-blue-400">{stats.cameras}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20">
                <DoorOpen className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-400">{stats.doors}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                <Siren className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-400">{stats.sirens}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <Radio className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-xs font-medium text-yellow-400">{stats.sensors}</span>
              </div>
              <Badge variant="outline" className="text-[10px] gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {stats.online}/{stats.total} {t('common.online') || 'Online'}
              </Badge>
            </div>
          )}
        </div>

        {/* ── Map area ───────────────────────────────────── */}
        <div className="flex-1 relative bg-[#0a0e1a]">
          {!selectedSiteId ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <Map className="h-16 w-16 opacity-30" />
              <p className="text-sm">{t('floorPlan.noSiteSelected') || 'Select a site to view its floor plan'}</p>
            </div>
          ) : loadingPlan ? (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
            </div>
          ) : siteDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <Map className="h-16 w-16 opacity-30" />
              <p className="text-sm">{t('floorPlan.noDevices') || 'No devices at this site'}</p>
            </div>
          ) : (
            <FloorPlanMap
              devices={siteDevices}
              positions={positions}
              onDeviceAction={handleDeviceAction}
              onPositionChange={(deviceId, x, y) => {
                setPositions(prev => {
                  const next = prev.map(p => p.deviceId === deviceId ? { ...p, x, y } : p);
                  try { localStorage.setItem(`aion-fp-${selectedSiteId}`, JSON.stringify(next)); } catch { /* */ }
                  // Persist to backend (non-blocking)
                  apiClient.put(`/floor-plans/${selectedSiteId}/positions`, {
                    positions: [{ deviceId, x, y }],
                  }).catch(() => { /* localStorage is the fallback */ });
                  return next;
                });
                toast.success('Posición guardada');
              }}
              siteName={selectedSite?.name as string | undefined}
              siteAddress={selectedSite?.address as string | undefined}
            />
          )}

          {/* ── Legend ──────────────────────────────────── */}
          {selectedSiteId && siteDevices.length > 0 && (
            <div className="absolute bottom-4 left-4 z-[1000] bg-[#111827]/90 backdrop-blur-sm border border-[#1e293b] rounded-lg px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {t('floorPlan.legend') || 'Legend'}
              </p>
              {[
                { color: '#3b82f6', label: `${t('floorPlan.cameras') || 'Cámaras'} (${stats.cameras})` },
                { color: '#22c55e', label: `${t('floorPlan.doors') || 'Puertas'} (${stats.doors})` },
                { color: '#ef4444', label: `${t('floorPlan.sirens') || 'Sirenas'} (${stats.sirens})` },
                { color: '#eab308', label: `${t('floorPlan.sensors') || 'Sensores'} (${stats.sensors})` },
              ].map((item) => (
                <div key={item.color} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ background: item.color }}
                  />
                  <span className="text-[11px] text-white/70">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom popup styles for dark theme */}
      <style>{`
        .floor-plan-popup .leaflet-popup-content-wrapper {
          background: #1e293b;
          color: #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          border: 1px solid rgba(100,160,255,0.15);
        }
        .floor-plan-popup .leaflet-popup-tip {
          background: #1e293b;
          border: 1px solid rgba(100,160,255,0.15);
          border-top: none;
          border-right: none;
        }
        .floor-plan-popup .leaflet-popup-close-button {
          color: #94a3b8;
        }
        .floor-plan-popup .leaflet-popup-close-button:hover {
          color: #e2e8f0;
        }
      `}</style>
    </PageShell>
  );
}
