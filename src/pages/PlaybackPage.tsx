import { useState, useRef, useMemo, useEffect } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useDevices, useSites, useEventsLegacy } from '@/hooks/use-api-data';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Camera, Download, Play, Pause, SkipBack, SkipForward,
  Scissors, Image, ChevronLeft, ChevronRight, Maximize, MonitorSpeaker,
  Wifi, WifiOff, ZoomIn, ZoomOut, Clock, AlertTriangle, Info,
  Loader2, Volume2, VolumeX, FastForward, Rewind
} from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

// ── Helpers ─────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatShortTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Convert ISO time segments from API to seconds-of-day format
function parseApiSegments(apiSegments: Array<{ start: string; end: string }>): Array<{ start: number; end: number; type: 'continuous' | 'motion' | 'alarm' }> {
  return apiSegments.map(seg => {
    const startDate = new Date(seg.start);
    const endDate = new Date(seg.end);
    return {
      start: startDate.getHours() * 3600 + startDate.getMinutes() * 60 + startDate.getSeconds(),
      end: endDate.getHours() * 3600 + endDate.getMinutes() * 60 + endDate.getSeconds(),
      type: 'continuous' as const,
    };
  });
}

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];
const DAY_SECONDS = 86400;

// ── Timeline Component ──────────────────────────────────────
function InteractiveTimeline({
  currentTime, onSeek, segments, events, zoomLevel, onZoomIn, onZoomOut,
  clipStart, clipEnd, onClipStartSet, onClipEndSet, isClipping,
}: {
  currentTime: number;
  onSeek: (t: number) => void;
  segments: Array<{ start: number; end: number; type: 'continuous' | 'motion' | 'alarm' }>;
  events: any[];
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  clipStart: number | null;
  clipEnd: number | null;
  onClipStartSet: () => void;
  onClipEndSet: () => void;
  isClipping: boolean;
}) {
  const { t } = useI18n();
  const timelineRef = useRef<HTMLDivElement>(null);

  // Zoom affects visible range
  const totalVisible = DAY_SECONDS / zoomLevel;
  const viewStart = Math.max(0, currentTime - totalVisible / 2);
  const viewEnd = Math.min(DAY_SECONDS, viewStart + totalVisible);
  const effectiveStart = viewEnd === DAY_SECONDS ? DAY_SECONDS - totalVisible : viewStart;
  const effectiveEnd = effectiveStart + totalVisible;

  const timeToPercent = (t: number) => ((t - effectiveStart) / totalVisible) * 100;

  const handleClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const t = effectiveStart + x * totalVisible;
    onSeek(Math.max(0, Math.min(DAY_SECONDS, t)));
  };

  // Time labels
  const labelCount = zoomLevel <= 2 ? 9 : zoomLevel <= 4 ? 13 : 25;
  const step = totalVisible / (labelCount - 1);
  const labels = Array.from({ length: labelCount }, (_, i) => effectiveStart + i * step);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onZoomOut} disabled={zoomLevel <= 1} aria-label="Alejar zoom">
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground font-mono">{zoomLevel}×</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onZoomIn} disabled={zoomLevel >= 16} aria-label="Acercar zoom">
          <ZoomIn className="h-3 w-3" />
        </Button>
        {isClipping && (
          <div className="flex items-center gap-1 ml-2">
            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onClipStartSet}>
              {t('playback.set_start')} {clipStart !== null && `(${formatTime(clipStart)})`}
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onClipEndSet}>
              {t('playback.set_end')} {clipEnd !== null && `(${formatTime(clipEnd)})`}
            </Button>
          </div>
        )}
      </div>

      <div
        ref={timelineRef}
        className="relative h-12 bg-muted/50 rounded-md overflow-hidden cursor-crosshair border"
        onClick={handleClick}
      >
        {/* Recording segments */}
        {segments.map((seg: { start: number; end: number; type: string }, i: number) => {
          const left = timeToPercent(seg.start);
          const width = timeToPercent(seg.end) - left;
          if (left > 100 || left + width < 0) return null;
          const color = seg.type === 'continuous' ? 'bg-primary/25' :
                       seg.type === 'motion' ? 'bg-warning/30' : 'bg-destructive/30';
          return (
            <div
              key={i}
              className={`absolute top-1 bottom-4 ${color} rounded-sm`}
              style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - Math.max(0, left), width)}%` }}
            />
          );
        })}

        {/* Event markers */}
        {events.map((evt, i) => {
          const evtTime = new Date(evt.created_at);
          const seconds = evtTime.getHours() * 3600 + evtTime.getMinutes() * 60 + evtTime.getSeconds();
          const pos = timeToPercent(seconds);
          if (pos < 0 || pos > 100) return null;
          const color = evt.severity === 'critical' ? 'bg-destructive' :
                       evt.severity === 'high' ? 'bg-warning' : 'bg-info';
          return (
            <div
              key={`evt-${i}`}
              className={`absolute top-0 bottom-4 w-0.5 ${color}`}
              style={{ left: `${pos}%` }}
              title={`${evt.title} (${evt.severity})`}
            />
          );
        })}

        {/* Clip region */}
        {clipStart !== null && clipEnd !== null && (
          <div
            className="absolute top-0 bottom-4 bg-primary/20 border-x border-primary"
            style={{
              left: `${Math.max(0, timeToPercent(clipStart))}%`,
              width: `${Math.max(0, timeToPercent(clipEnd) - timeToPercent(clipStart))}%`,
            }}
          />
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
          style={{ left: `${timeToPercent(currentTime)}%` }}
        >
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-foreground rounded-full" />
        </div>

        {/* Time labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[8px] text-muted-foreground">
          {labels.filter((_, i) => i % Math.max(1, Math.floor(labelCount / 9)) === 0).map((t, i) => (
            <span key={i}>{formatShortTime(Math.round(t))}</span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-primary/25 rounded-sm" /> {t('playback.continuous')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-warning/30 rounded-sm" /> {t('playback.motion')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-destructive/30 rounded-sm" /> {t('playback.alarm')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-destructive" /> {t('playback.critical_event')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-warning" /> {t('playback.high')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-info" /> {t('playback.info')}</span>
        {clipStart !== null && <span className="flex items-center gap-1"><span className="w-3 h-2 bg-primary/20 border border-primary rounded-sm" /> {t('playback.clip_selection')}</span>}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function PlaybackPage() {
  const { t } = useI18n();
  const { data: devices = [], isLoading: devLoading } = useDevices();
  const { data: sites = [] } = useSites();
  const { data: events = [] } = useEventsLegacy();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Cameras come from /cameras endpoint via react-query
  const { data: camerasRaw = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cameras-playback'],
    queryFn: async () => {
      const resp = await apiClient.get<any>('/cameras', { limit: '500' });
      return Array.isArray(resp) ? resp : (resp?.items ?? resp?.data ?? []);
    },
    enabled: !!profile,
  });
  const cameras = Array.isArray(camerasRaw) ? camerasRaw : [];
  const [selectedDevice, setSelectedDevice] = useState(() => {
    try { return localStorage.getItem('aion-pb-cam') || ''; } catch { return ''; }
  });
  const [selectedChannel, setSelectedChannel] = useState('1');

  // Persist camera selection
  useEffect(() => { try { localStorage.setItem('aion-pb-cam', selectedDevice); } catch { /* */ } }, [selectedDevice]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(8 * 3600); // Start at 08:00
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isClipping, setIsClipping] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');

  const device = cameras.find((d: any) => d.id === selectedDevice) || cameras[0];

  // Fetch real recording segments from backend playback API
  const { data: apiSegments } = useQuery({
    queryKey: ['playback-segments', selectedDate, device?.id],
    queryFn: async () => {
      try {
        const res = await apiClient.post('/playback/search', { date: selectedDate, cameraId: device?.id });
        const r = res as Record<string, unknown>;
        return ((r?.data as Record<string, unknown>)?.segments ?? r?.segments ?? []) as Record<string, unknown>[];
      } catch { return []; }
    },
    enabled: !!device,
    staleTime: 60000,
  });
  const segments = useMemo(() => parseApiSegments(apiSegments || []), [apiSegments]);

  // Filter events for the selected device and date
  const deviceEvents = useMemo(() => {
    if (!device) return [];
    return events.filter((e: any) => {
      const ts = e.createdAt || e.created_at || '';
      const eventDate = typeof ts === 'string' ? ts.slice(0, 10) : '';
      return e.device_id === device.id && eventDate === selectedDate;
    });
  }, [events, device, selectedDate]);

  // Playback simulation timer
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + speed;
          if (next >= DAY_SECONDS) {
            setPlaying(false);
            return DAY_SECONDS;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed]);

  // Playback requests from DB
  const { data: playbackRequests = [] } = useQuery({
    queryKey: ['playback_requests'],
    queryFn: async () => {
      const data = await apiClient.get<Record<string, unknown>[]>('/streams/playback-requests', {
        limit: '20',
        order: 'created_at:desc',
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!profile,
  });

  // Create playback/export request
  const createExport = useMutation({
    mutationFn: async () => {
      if (!device || !user || !profile || clipStart === null || clipEnd === null) {
        throw new Error('Seleccione una región de clip primero');
      }
      if (clipStart >= clipEnd) {
        throw new Error('El inicio del clip debe ser antes del final');
      }
      const startDate = new Date(`${selectedDate}T00:00:00Z`);
      const endDate = new Date(`${selectedDate}T00:00:00Z`);
      startDate.setSeconds(startDate.getSeconds() + clipStart);
      endDate.setSeconds(endDate.getSeconds() + clipEnd);

      await apiClient.post('/streams/playback', {
        device_id: device.id,
        channel: parseInt(selectedChannel),
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playback_requests'] });
      toast.success('Solicitud creada. El clip será procesado por el gateway.');
      setExportDialogOpen(false);
      setIsClipping(false);
      setClipStart(null);
      setClipEnd(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSeek = (t: number) => setCurrentTime(t);
  const skipBack = () => setCurrentTime(prev => Math.max(0, prev - 30));
  const skipForward = () => setCurrentTime(prev => Math.min(DAY_SECONDS, prev + 30));
  const prevSpeed = () => setSpeed(prev => SPEEDS[Math.max(0, SPEEDS.indexOf(prev) - 1)]);
  const nextSpeed = () => setSpeed(prev => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(prev) + 1)]);

  const handleSnapshot = () => {
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/jpeg', 0.92);
      a.download = `${device?.name || 'camera'}-${selectedDate}-${formatTime(currentTime).replace(/:/g, '')}.jpg`;
      a.click();
      toast.success(`Captura guardada: ${device?.name} a las ${formatTime(currentTime)}`);
    } else {
      toast.info(`Captura: ${device?.name || 'cámara'} a las ${formatTime(currentTime)} (sin video activo)`);
    }
  };

  const startClipping = () => {
    setIsClipping(true);
    setClipStart(currentTime);
    setClipEnd(null);
    toast.info('Click "Set Start" and "Set End" on the timeline, or use current playhead position');
  };

  const handleDateNav = (dir: -1 | 1) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().slice(0, 10));
    setCurrentTime(0);
    setPlaying(false);
  };

  // Check if current time falls within a recorded segment
  const isInRecording = segments.some(s => currentTime >= s.start && currentTime <= s.end);

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left sidebar - Camera & Event list */}
      <div className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-3 border-b space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('playback.camera')}</Label>
            {isLoading ? <Skeleton className="h-8 w-full" /> : (
              <Select value={selectedDevice || device?.id || ''} onValueChange={setSelectedDevice}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('playback.select_camera')} /></SelectTrigger>
                <SelectContent>
                  {cameras.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      <div className="flex items-center gap-2">
                        {d.status === 'online' ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-destructive" />}
                        {d.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('playback.channel')}</Label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: device?.channels || 1 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{t('playback.channel')} {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('playback.date')}</Label>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDateNav(-1)} aria-label="Día anterior">
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setCurrentTime(0); setPlaying(false); }}
                className="h-8 text-xs flex-1"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDateNav(1)} aria-label="Día siguiente">
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Device info */}
        {device && (
          <div className="p-3 border-b space-y-1 text-xs">
            <div className="flex items-center gap-2">
              {device.status === 'online' ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-destructive" />}
              <span className="font-medium">{device.name}</span>
            </div>
            <p className="text-muted-foreground font-mono text-[10px]">{device.ip_address}:{device.rtsp_port || 554}</p>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-[9px]">{device.brand}</Badge>
              <Badge variant="outline" className="text-[9px]">{device.model}</Badge>
            </div>
          </div>
        )}

        {/* Events for this device/date */}
        <div className="p-2 border-b space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
            {t('playback.events')} ({deviceEvents.length})
          </p>
          <Input
            placeholder={t('playback.search_events')}
            value={eventSearchQuery}
            onChange={e => setEventSearchQuery(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1 space-y-0.5">
            {deviceEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">{t('playback.no_events_date')}</p>
            ) : deviceEvents.filter((evt: any) => !eventSearchQuery || (evt.title || '').toLowerCase().includes(eventSearchQuery.toLowerCase()) || (evt.event_type || '').toLowerCase().includes(eventSearchQuery.toLowerCase())).map((evt: any) => {
              const evtDate = new Date(evt.created_at || evt.createdAt);
              const evtSeconds = evtDate.getHours() * 3600 + evtDate.getMinutes() * 60 + evtDate.getSeconds();
              return (
                <div
                  key={evt.id}
                  className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => { setCurrentTime(evtSeconds); setPlaying(false); }}
                >
                  {evt.severity === 'critical' ? <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" /> :
                   evt.severity === 'high' ? <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" /> :
                   <Info className="h-3 w-3 text-info mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium truncate">{evt.title || evt.description || evt.event_type}</p>
                    <p className="text-[9px] text-muted-foreground">{formatTime(evtSeconds)} • {(evt.event_type || '').replace(/_/g, ' ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Export History */}
        <div className="p-2 border-t">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-1">
            {t('playback.recent_exports')} ({playbackRequests.length})
          </p>
          <ScrollArea className="max-h-32">
            {playbackRequests.slice(0, 5).map((req: any) => (
              <div key={req.id} className="text-[10px] p-1.5 rounded hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{new Date(req.start_time).toLocaleTimeString()} → {new Date(req.end_time).toLocaleTimeString()}</span>
                  <Badge variant={req.status === 'ready' ? 'default' : req.status === 'processing' ? 'outline' : 'secondary'} className="text-[8px] h-4">
                    {req.status}
                  </Badge>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Video area — real stream from go2rtc */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
          {!device ? (
            <div className="text-center">
              <Camera className="h-16 w-16 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">{t('playback.select_camera_to_play')}</p>
            </div>
          ) : isInRecording && device.status === 'online' ? (
            /* Real video stream from go2rtc */
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-contain bg-black"
              autoPlay
              muted={muted}
              playsInline
              src={`/go2rtc/api/stream.mp4?src=${encodeURIComponent(device.stream_key || device.id)}`}
              onError={() => setVideoError(true)}
            />
          ) : (
            /* Snapshot fallback or no-recording state */
            <div className="text-center">
              <MonitorSpeaker className="h-16 w-16 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">{device.name} — Canal {selectedChannel}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                {selectedDate} • {formatTime(currentTime)}
              </p>
              <Badge variant={isInRecording ? 'default' : 'secondary'} className="text-[10px] mt-2">
                {isInRecording ? t('playback.recording_available') : t('playback.no_recording')}
              </Badge>
              {videoError && (
                <p className="text-[10px] text-destructive/60 mt-2">{t('playback.stream_unavailable')}</p>
              )}
            </div>
          )}

          {/* Overlay info */}
          {device && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge variant="outline" className="text-[9px] bg-black/60 backdrop-blur text-white border-white/20">
                  {device.brand} • {device.model}
                </Badge>
                <Badge variant="outline" className="text-[9px] bg-black/60 backdrop-blur text-white border-white/20 font-mono">
                  CH{selectedChannel}
                </Badge>
                {playing && (
                  <Badge variant="outline" className="text-[9px] bg-red-600/80 backdrop-blur text-white border-red-400/40 font-mono">
                    ● {speed}×
                  </Badge>
                )}
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge variant="outline" className="text-[9px] bg-black/60 backdrop-blur text-white border-white/20 font-mono">
                  <Clock className="h-3 w-3 mr-1" />{formatTime(currentTime)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/20"
                  onClick={() => {
                    const el = document.querySelector('.playback-video-area');
                    if (el) (el as HTMLElement).requestFullscreen?.();
                  }}
                >
                  <Maximize className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Transport controls */}
        <div className="border-t bg-card p-3 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevSpeed} title="Slower" aria-label="Más lento">
              <Rewind className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={skipBack} title="-30s" aria-label="Retroceder 30 segundos">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setPlaying(!playing)}
              disabled={!device}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={skipForward} title="+30s" aria-label="Adelantar 30 segundos">
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextSpeed} title="Faster" aria-label="Más rápido">
              <FastForward className="h-3.5 w-3.5" />
            </Button>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Badge variant="outline" className="text-[10px] font-mono cursor-pointer" onClick={() => setSpeed(1)}>
              {speed}×
            </Badge>

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMuted(!muted)} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </Button>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <span className="text-xs font-mono text-muted-foreground">
              {formatTime(currentTime)} / 24:00:00
            </span>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant={isClipping ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => isClipping ? setIsClipping(false) : startClipping()}
              >
                <Scissors className="mr-1 h-3 w-3" /> {isClipping ? t('playback.cancel') : t('playback.clip')}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSnapshot}>
                <Image className="mr-1 h-3 w-3" /> {t('playback.snapshot')}
              </Button>

              <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={clipStart === null || clipEnd === null}
                  >
                    <Download className="mr-1 h-3 w-3" /> {t('playback.export')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('playback.export_clip_title')}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="p-3 rounded-md bg-muted text-xs space-y-1">
                      <p><strong>{t('playback.export_camera')}:</strong> {device?.name}</p>
                      <p><strong>{t('playback.export_channel')}:</strong> {selectedChannel}</p>
                      <p><strong>{t('playback.export_date')}:</strong> {selectedDate}</p>
                      <p><strong>{t('playback.export_start')}:</strong> {clipStart !== null ? formatTime(clipStart) : '—'}</p>
                      <p><strong>{t('playback.export_end')}:</strong> {clipEnd !== null ? formatTime(clipEnd) : '—'}</p>
                      <p><strong>{t('playback.export_duration')}:</strong> {clipStart !== null && clipEnd !== null ? formatTime(clipEnd - clipStart) : '—'}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('playback.export_desc')}
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => createExport.mutate()}
                      disabled={createExport.isPending || clipStart === null || clipEnd === null}
                    >
                      {createExport.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                      {t('playback.create_export')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Interactive Timeline */}
          <InteractiveTimeline
            currentTime={currentTime}
            onSeek={handleSeek}
            segments={segments}
            events={deviceEvents}
            zoomLevel={zoomLevel}
            onZoomIn={() => setZoomLevel(prev => Math.min(16, prev * 2))}
            onZoomOut={() => setZoomLevel(prev => Math.max(1, prev / 2))}
            clipStart={clipStart}
            clipEnd={clipEnd}
            onClipStartSet={() => setClipStart(currentTime)}
            onClipEndSet={() => setClipEnd(currentTime)}
            isClipping={isClipping}
          />
        </div>
      </div>
    </div>
  );
}
