import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { deviceControlApi } from '@/services/device-control-api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Video,
  Grid3X3,
  Maximize,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Loader2,
  PanelRightOpen,
  PanelRightClose,
  Search,
  DoorOpen,
  Car,
  UserPlus,
  Phone,
  Bot,
  ShieldAlert,
  CheckCircle2,
  Send,
  User,
  Building2,
  Clock,
  AlertTriangle,
  X,
  Zap,
  Power,
  Siren,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface Camera {
  id: string;
  name: string;
  stream_key: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown' | 'maintenance';
  site_id: string;
}

interface SiteGroup {
  site_id: string;
  site_name: string;
  cameras: Camera[];
}

interface Resident {
  id: string;
  full_name: string;
  unit_number?: string;
  phone?: string;
  email?: string;
  site_id?: string;
  vehicle_plate?: string;
  status?: string;
}

interface Vehicle {
  id: string;
  plate: string;
  brand?: string;
  color?: string;
  vehicle_type?: string;
  resident_id?: string;
  resident_name?: string;
  resident_unit?: string;
}

interface DomoticDevice {
  id: string;
  name: string;
  type: string;
  status: string;
  sectionId?: string;
}

interface GateDevice {
  id: string;
  name: string;
  type: string;
  status: string;
  [key: string]: unknown;
}

interface RecentEvent {
  id: string;
  severity: string;
  eventType: string;
  description?: string;
  createdAt: string;
  siteName?: string;
}

type GridSize = 4 | 9 | 16;

const SDK_ONLY_PREFIXES = ['ss-', 'ag-', 'pq-', 'tl-', 'se-', 'ar-', 'br-'];
const isSnapshotOnly = (key: string) =>
  SDK_ONLY_PREFIXES.some((p) => key.startsWith(p));

// ── Camera Cell ─────────────────────────────────────────────

function CameraCell({
  camera,
  isSelected,
  onClick,
  onDoubleClick,
}: {
  camera: Camera | null;
  isSelected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);
  const [mode, setMode] = useState<'video' | 'snapshot' | 'init'>('init');

  useEffect(() => {
    if (!camera || camera.status !== 'online') return;
    setMode(isSnapshotOnly(camera.stream_key) ? 'snapshot' : 'video');
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [camera]);

  useEffect(() => {
    if (!camera || camera.status !== 'online' || mode !== 'snapshot') return;
    const key = camera.stream_key;
    const refreshFrame = () => {
      if (imgRef.current)
        imgRef.current.src = `/snapshots/${encodeURIComponent(key)}.jpg?t=${Date.now()}`;
    };
    refreshFrame();
    timerRef.current = window.setInterval(refreshFrame, 3000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [camera, mode]);

  useEffect(() => {
    if (!camera || camera.status !== 'online' || mode !== 'video') return;
    const video = videoRef.current;
    if (!video) return;
    const key = camera.stream_key;
    video.src = `/go2rtc/api/stream.mp4?src=${encodeURIComponent(key)}`;
    video.play().catch(() => {});
    const handleError = () => setMode('snapshot');
    const handleStall = () => {
      setTimeout(() => { if (video.readyState < 2) setMode('snapshot'); }, 5000);
    };
    video.addEventListener('error', handleError);
    video.addEventListener('stalled', handleStall);
    return () => {
      video.removeEventListener('error', handleError);
      video.removeEventListener('stalled', handleStall);
      video.src = '';
      video.load();
    };
  }, [camera, mode]);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.();
    const el = containerRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
  }, [onDoubleClick]);

  if (!camera) {
    return (
      <Card className="relative flex items-center justify-center bg-muted/30 border-dashed">
        <div className="text-center text-muted-foreground">
          <Video className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs opacity-50">Sin cámara</p>
        </div>
      </Card>
    );
  }

  const isOnline = camera.status === 'online';

  return (
    <Card
      ref={containerRef}
      className={`relative overflow-hidden bg-black border-border/50 group cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
      }`}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
    >
      {mode === 'snapshot' ? (
        <img
          ref={imgRef}
          alt={camera.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
      )}

      {!isOnline && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 z-10">
          <WifiOff className="h-8 w-8 text-destructive/60 mb-2" />
          <p className="text-xs text-muted-foreground">Offline</p>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/90 to-transparent z-20 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isOnline
                ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
            }`}
          />
          <span className="text-xs font-medium text-white truncate drop-shadow-md">
            {camera.name}
          </span>
        </div>
      </div>

      {isOnline && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-sm border border-white/10 z-20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] text-white/90 font-mono font-medium tracking-widest">LIVE</span>
        </div>
      )}
    </Card>
  );
}

// ── Operator Panel: Resident/Vehicle Search ────────────────

function SearchPanel() {
  const [searchType, setSearchType] = useState<'resident' | 'vehicle'>('resident');
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: residents = [], isFetching: fetchingResidents } = useQuery<Resident[]>({
    queryKey: ['op-search-residents', searchTerm],
    queryFn: () => apiClient.get(`/operational-data/residents?search=${encodeURIComponent(searchTerm)}&limit=10`),
    enabled: searchType === 'resident' && searchTerm.length >= 2,
  });

  const { data: vehicles = [], isFetching: fetchingVehicles } = useQuery<Vehicle[]>({
    queryKey: ['op-search-vehicles', searchTerm],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Vehicle[] }>(`/operational-data/vehicles?search=${encodeURIComponent(searchTerm)}&limit=10`);
      return Array.isArray(res) ? res : (res as any)?.data ?? (res as any) ?? [];
    },
    enabled: searchType === 'vehicle' && searchTerm.length >= 2,
  });

  const doSearch = () => {
    if (query.length >= 2) setSearchTerm(query);
  };

  const isFetching = searchType === 'resident' ? fetchingResidents : fetchingVehicles;
  const results = searchType === 'resident' ? residents : vehicles;

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <Button
          variant={searchType === 'resident' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => { setSearchType('resident'); setSearchTerm(''); setQuery(''); }}
        >
          <User className="h-3 w-3 mr-1" />
          Persona
        </Button>
        <Button
          variant={searchType === 'vehicle' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => { setSearchType('vehicle'); setSearchTerm(''); setQuery(''); }}
        >
          <Car className="h-3 w-3 mr-1" />
          Vehículo
        </Button>
      </div>

      <div className="flex gap-1">
        <Input
          placeholder={searchType === 'resident' ? 'Nombre o apartamento...' : 'Placa del vehículo...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 px-2" onClick={doSearch} disabled={query.length < 2}>
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {searchTerm && (
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-1">
            {(results as any[]).length === 0 && !isFetching && (
              <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
            )}
            {searchType === 'resident'
              ? (results as Resident[]).map((r) => (
                  <Card key={r.id} className="p-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold">{r.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.unit_number && `Apto ${r.unit_number}`}
                          {r.phone && ` · ${r.phone}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-green-500" />
                        Registrado
                      </Badge>
                    </div>
                  </Card>
                ))
              : (results as Vehicle[]).map((v) => (
                  <Card key={v.id} className="p-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold font-mono tracking-wider">{v.plate}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {v.brand && `${v.brand} `}
                          {v.color && `${v.color} `}
                          {v.resident_name && `· ${v.resident_name}`}
                          {v.resident_unit && ` (${v.resident_unit})`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-green-500" />
                        Autorizado
                      </Badge>
                    </div>
                  </Card>
                ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ── Operator Panel: Door/Gate Control ───────────────────────

function DoorControlPanel() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const { data: devices = [] } = useQuery<GateDevice[]>({
    queryKey: ['devices-for-gate'],
    queryFn: () => apiClient.get('/devices'),
    select: (raw: Record<string, unknown> | GateDevice[]) => {
      const items = Array.isArray(raw) ? raw : ((raw as Record<string, unknown>)?.items ?? []) as GateDevice[];
      return items.filter(
        (d: GateDevice) =>
          d.status === 'online' &&
          (d.type === 'access_control' ||
            d.type === 'intercom' ||
            /gate|puerta|door|barrera|acceso|portería/i.test((d.name as string) || ''))
      );
    },
  });

  const { data: relays = [] } = useQuery<DomoticDevice[]>({
    queryKey: ['domotics-relays'],
    queryFn: () => apiClient.get('/domotics/devices'),
    select: (raw: Record<string, unknown> | DomoticDevice[]) => {
      const items = Array.isArray(raw) ? raw : [];
      return items.filter((d: DomoticDevice) => d.type === 'relay' && d.status === 'online');
    },
  });

  const openGate = useMutation({
    mutationFn: (deviceId: string) => deviceControlApi.openGate(deviceId, reason || 'Apertura desde Live View'),
    onSuccess: () => {
      toast.success('Puerta abierta correctamente');
      setConfirming(false);
      setReason('');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const toggleRelay = useMutation({
    mutationFn: (deviceId: string) =>
      apiClient.post('/ewelink/devices/control', { deviceId, action: 'toggle' }),
    onSuccess: () => toast.success('Relay activado'),
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
        Hikvision / Control Acceso
      </p>
      {devices.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No hay dispositivos de acceso online</p>
      ) : (
        <div className="space-y-1">
          {devices.slice(0, 6).map((d: GateDevice) => (
            <div key={d.id} className="flex items-center justify-between gap-2">
              <span className="text-xs truncate flex-1">{d.name}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 text-green-600 border-green-600/30 hover:bg-green-600/10"
                onClick={() => {
                  setSelectedDevice(d.id);
                  setConfirming(true);
                }}
              >
                <DoorOpen className="h-3 w-3 mr-1" />
                Abrir
              </Button>
            </div>
          ))}
        </div>
      )}

      <Separator />

      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
        eWeLink / Relays
      </p>
      {relays.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No hay relays online</p>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {relays.slice(0, 8).map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant="outline"
              className="h-7 text-[10px] justify-start"
              onClick={() => toggleRelay.mutate(r.id)}
              disabled={toggleRelay.isPending}
            >
              <Zap className="h-3 w-3 mr-1 text-yellow-500" />
              <span className="truncate">{r.name}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              Confirmar apertura
            </DialogTitle>
            <DialogDescription>
              {devices.find((d: GateDevice) => d.id === selectedDevice)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Visitante autorizado"
              className="h-8 text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => openGate.mutate(selectedDevice)}
              disabled={openGate.isPending}
            >
              {openGate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <DoorOpen className="h-4 w-4 mr-1" />
              )}
              Abrir puerta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Operator Panel: Quick Visitor Registration ──────────────

function VisitorPanel() {
  const [name, setName] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');

  const registerVisitor = useMutation({
    mutationFn: () =>
      apiClient.post('/visitors', {
        fullName: name,
        documentNumber: docNumber,
        destination,
        notes,
        checkInAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success('Visitante registrado');
      setName('');
      setDocNumber('');
      setDestination('');
      setNotes('');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Nombre completo</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Juan Pérez"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px]">Documento</Label>
          <Input
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            placeholder="CC 1234567"
            className="h-7 text-xs"
          />
        </div>
      </div>
      <div>
        <Label className="text-[10px]">Destino (apto/oficina)</Label>
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Apto 301"
          className="h-7 text-xs"
        />
      </div>
      <div>
        <Label className="text-[10px]">Observaciones</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Motivo de visita..."
          className="h-14 text-xs resize-none"
        />
      </div>
      <Button
        size="sm"
        className="w-full h-8 text-xs"
        onClick={() => registerVisitor.mutate()}
        disabled={!name || !docNumber || registerVisitor.isPending}
      >
        {registerVisitor.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
        ) : (
          <UserPlus className="h-3.5 w-3.5 mr-1" />
        )}
        Registrar visitante
      </Button>
    </div>
  );
}

// ── Operator Panel: AI Assistant ────────────────────────────

function AIAssistantPanel() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;
    const userMsg = { role: 'user', content: message };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setMessage('');
    setIsLoading(true);

    try {
      const res = await apiClient.post<{ content: string }>('/ai/chat', {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        enableTools: true,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.content || 'Sin respuesta' }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }

    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea ref={scrollRef} className="flex-1 max-h-[220px]">
        <div className="space-y-2 p-1">
          {messages.length === 0 && (
            <div className="text-center py-4">
              <Bot className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[10px] text-muted-foreground">
                Pregunta sobre cámaras, residentes, eventos, o pide ayuda operativa
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-xs rounded-lg px-2.5 py-1.5 max-w-[95%] ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-auto'
                  : 'bg-muted'
              }`}
            >
              {m.content}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Pensando...
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="flex gap-1 mt-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="¿Cuántas cámaras offline?"
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 px-2" onClick={sendMessage} disabled={!message.trim() || isLoading}>
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Operator Panel: Live Events ─────────────────────────────

function EventsPanel() {
  const { data: events = [] } = useQuery<RecentEvent[]>({
    queryKey: ['live-events'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/events?limit=15&sort_by=created_at&sort_order=desc');
      return Array.isArray(res) ? res : [];
    },
    refetchInterval: 10_000,
  });

  const severityColor: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
    info: 'bg-slate-400',
  };

  return (
    <ScrollArea className="max-h-[280px]">
      <div className="space-y-1">
        {events.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Sin eventos recientes</p>
        )}
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-2 px-1 py-1.5 rounded hover:bg-muted/50">
            <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${severityColor[e.severity] || 'bg-slate-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium truncate">
                {e.eventType?.replace(/_/g, ' ')}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {e.description || e.siteName || ''}
              </p>
            </div>
            <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
              {new Date(e.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ══════════════════════════════════════════════════════════════
// ── MAIN LIVE VIEW PAGE ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export default function LiveViewPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [gridSize, setGridSize] = useState<GridSize>(9);

  // Auto-detect optimal grid size on mount based on viewport width
  useEffect(() => {
    const w = window.innerWidth;
    if (w < 768) setGridSize(4);       // mobile: 2x2
    else if (w < 1280) setGridSize(9); // tablet: 3x3
    // desktop keeps default or user choice
  }, []);

  const [currentPage, setCurrentPage] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [opsOpen, setOpsOpen] = useState(true);
  const [opsTab, setOpsTab] = useState('search');
  const autoRotateRef = useRef(autoRotate);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // ── Data ──────────────────────────────────────────────────

  const {
    data: siteGroups = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SiteGroup[]>({
    queryKey: ['cameras-by-site'],
    queryFn: async () => {
      const raw = await apiClient.get<SiteGroup[] | Record<string, unknown[]>>('/cameras/by-site');
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') {
        return Object.entries(raw).map(([name, cameras]) => ({
          site_id: name,
          site_name: name,
          cameras: Array.isArray(cameras) ? cameras : [],
        })) as SiteGroup[];
      }
      return [];
    },
    enabled: !!profile,
    refetchInterval: 30_000,
  });

  const syncStatus = useMutation({
    mutationFn: () => apiClient.post('/cameras/sync-status'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras-by-site'] });
      toast.success('Estado de cámaras sincronizado');
    },
    onError: (err: Error) => toast.error(`Error sincronizando: ${err.message}`),
  });

  // ── Derived ───────────────────────────────────────────────

  const allCameras = useMemo(() => siteGroups.flatMap((sg) => sg.cameras), [siteGroups]);

  const filteredCameras = useMemo(() => {
    if (selectedSite === 'all') return allCameras;
    const group = siteGroups.find((sg) => sg.site_id === selectedSite);
    return group ? group.cameras : [];
  }, [allCameras, siteGroups, selectedSite]);

  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / gridSize));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(0);
  }, [selectedSite, gridSize]);

  const paginatedCameras = useMemo(() => {
    const start = currentPage * gridSize;
    const slice = filteredCameras.slice(start, start + gridSize);
    const padded: (Camera | null)[] = [...slice];
    while (padded.length < gridSize) padded.push(null);
    return padded;
  }, [filteredCameras, currentPage, gridSize]);

  const siteStats = useMemo(() => {
    const stats: Record<string, { online: number; offline: number; total: number }> = {};
    siteGroups.forEach((sg) => {
      const online = (sg.cameras || []).filter((c) => c.status === 'online').length;
      stats[sg.site_id] = { online, offline: sg.cameras.length - online, total: sg.cameras.length };
    });
    const allOnline = allCameras.filter((c) => c.status === 'online').length;
    stats['all'] = { online: allOnline, offline: allCameras.length - allOnline, total: allCameras.length };
    return stats;
  }, [siteGroups, allCameras]);

  // ── Auto-Rotation ─────────────────────────────────────────

  useEffect(() => {
    if (!autoRotate || totalPages <= 1) return;
    const interval = setInterval(() => {
      if (autoRotateRef.current) setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 60_000);
    return () => clearInterval(interval);
  }, [autoRotate, totalPages]);

  const goToPrevPage = useCallback(() => setCurrentPage((prev) => Math.max(0, prev - 1)), []);
  const goToNextPage = useCallback(() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1)), [totalPages]);

  const toggleFullscreen = useCallback(() => {
    if (!gridContainerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else gridContainerRef.current.requestFullscreen().catch(() => {});
  }, []);

  const cols = Math.sqrt(gridSize);
  const gridOptions: { size: GridSize; label: string }[] = [
    { size: 4, label: '2×2' },
    { size: 9, label: '3×3' },
    { size: 16, label: '4×4' },
  ];

  // ── Error state ───────────────────────────────────────────

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Card className="p-6 max-w-md text-center">
          <WifiOff className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h3 className="text-lg font-semibold mb-1">Error cargando cámaras</h3>
          <p className="text-sm text-muted-foreground mb-4">{(error as Error)?.message}</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* ═══ LEFT: Site Sidebar ═══ */}
        <div className="w-52 border-r bg-card flex flex-col shrink-0">
          <div className="p-2.5 border-b">
            <h2 className="text-xs font-bold tracking-tight flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Puestos
            </h2>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-1.5 space-y-0.5">
              <button
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors ${
                  selectedSite === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedSite('all')}
              >
                <span className="font-medium">Todos</span>
                {siteStats['all'] && (
                  <span className="text-[10px] tabular-nums opacity-80">
                    {siteStats['all'].online}/{siteStats['all'].total}
                  </span>
                )}
              </button>

              {siteGroups.map((sg) => (
                <button
                  key={sg.site_id}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors ${
                    selectedSite === sg.site_id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedSite(sg.site_id)}
                >
                  <span className="font-medium truncate pr-2">{sg.site_name}</span>
                  {siteStats[sg.site_id] && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[10px] tabular-nums opacity-80">
                        {siteStats[sg.site_id].online}
                      </span>
                    </div>
                  )}
                </button>
              ))}

              {isLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-2 border-t text-[10px] text-muted-foreground">
            {filteredCameras.length} cámaras {selectedSite !== 'all' ? 'en puesto' : 'total'}
          </div>
        </div>

        {/* ═══ CENTER: Video Grid ═══ */}
        <div className="flex-1 flex flex-col min-w-0" ref={gridContainerRef}>
          {/* Controls bar */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-card">
            <div className="flex items-center border rounded-md" role="group">
              {gridOptions.map((opt) => (
                <Button
                  key={opt.size}
                  variant={gridSize === opt.size ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 rounded-none first:rounded-l-md last:rounded-r-md text-xs"
                  onClick={() => setGridSize(opt.size)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-0.5">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goToPrevPage} disabled={currentPage === 0}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground px-1.5 tabular-nums">
                  {currentPage + 1}/{totalPages}
                </span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goToNextPage} disabled={currentPage >= totalPages - 1}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <Button
              variant={autoRotate ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setAutoRotate(!autoRotate)}
            >
              {autoRotate ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
              Auto
            </Button>

            <div className="ml-auto flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] h-5">
                <Wifi className="h-2.5 w-2.5 mr-1 text-green-500" />
                {filteredCameras.filter((c) => c.status === 'online').length}/{filteredCameras.length}
              </Badge>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => syncStatus.mutate()} disabled={syncStatus.isPending}>
                    {syncStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sincronizar estado</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={toggleFullscreen}>
                    <Maximize className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pantalla completa</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={opsOpen ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setOpsOpen(!opsOpen)}
                  >
                    {opsOpen ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{opsOpen ? 'Cerrar panel' : 'Panel de operaciones'}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Video grid */}
          <div className="flex-1 p-1.5 bg-background">
            {isLoading ? (
              <div
                className="grid gap-1 h-full"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${cols}, 1fr)` }}
              >
                {Array.from({ length: gridSize }).map((_, i) => (
                  <Card key={i} className="flex items-center justify-center bg-muted/20 animate-pulse">
                    <Video className="h-8 w-8 text-muted-foreground/20" />
                  </Card>
                ))}
              </div>
            ) : (
              <div
                className="grid gap-1 h-full"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${cols}, 1fr)` }}
              >
                {paginatedCameras.map((camera, i) => (
                  <CameraCell key={camera?.id ?? `empty-${i}`} camera={camera} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT: Operations Panel ═══ */}
        {opsOpen && (
          <div className="w-80 border-l bg-card flex flex-col shrink-0">
            <div className="p-2.5 border-b flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-tight flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                Centro de Operaciones
              </h2>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpsOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>

            <Tabs value={opsTab} onValueChange={setOpsTab} className="flex-1 flex flex-col">
              <TabsList className="mx-2 mt-2 h-8 grid grid-cols-5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="search" className="h-7 px-1.5">
                      <Search className="h-3.5 w-3.5" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Buscar persona / vehículo</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="doors" className="h-7 px-1.5">
                      <DoorOpen className="h-3.5 w-3.5" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Control de puertas / relays</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="visitor" className="h-7 px-1.5">
                      <UserPlus className="h-3.5 w-3.5" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Registrar visitante</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="events" className="h-7 px-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Eventos en vivo</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="ai" className="h-7 px-1.5">
                      <Bot className="h-3.5 w-3.5" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Asistente IA</TooltipContent>
                </Tooltip>
              </TabsList>

              <ScrollArea className="flex-1">
                <div className="p-3">
                  <TabsContent value="search" className="mt-0">
                    <SearchPanel />
                  </TabsContent>

                  <TabsContent value="doors" className="mt-0">
                    <DoorControlPanel />
                  </TabsContent>

                  <TabsContent value="visitor" className="mt-0">
                    <VisitorPanel />
                  </TabsContent>

                  <TabsContent value="events" className="mt-0">
                    <EventsPanel />
                  </TabsContent>

                  <TabsContent value="ai" className="mt-0">
                    <AIAssistantPanel />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
