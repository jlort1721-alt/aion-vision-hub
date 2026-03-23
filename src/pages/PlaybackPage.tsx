import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useDevices, useSites, useEventsLegacy } from '@/hooks/use-supabase-data';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar, Camera, Download, Play, Pause, SkipBack, SkipForward,
  Scissors, Image, ChevronLeft, ChevronRight, Maximize, MonitorSpeaker,
  Wifi, WifiOff, ZoomIn, ZoomOut, Clock, AlertTriangle, Info,
  Loader2, Volume2, VolumeX, FastForward, Rewind
} from 'lucide-react';

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

// Simulated recording segments for a 24h day
function generateRecordingSegments() {
  const segments: { start: number; end: number; type: 'continuous' | 'motion' | 'alarm' }[] = [];
  // Continuous recording blocks
  segments.push({ start: 0 * 3600, end: 2 * 3600, type: 'continuous' });
  segments.push({ start: 6 * 3600, end: 9 * 3600, type: 'continuous' });
  segments.push({ start: 10 * 3600, end: 14 * 3600, type: 'continuous' });
  segments.push({ start: 16 * 3600, end: 22 * 3600, type: 'continuous' });
  // Motion events
  segments.push({ start: 3 * 3600 + 1200, end: 3 * 3600 + 1800, type: 'motion' });
  segments.push({ start: 5 * 3600 + 600, end: 5 * 3600 + 900, type: 'motion' });
  segments.push({ start: 15 * 3600, end: 15 * 3600 + 600, type: 'motion' });
  // Alarm
  segments.push({ start: 22 * 3600 + 3000, end: 22 * 3600 + 3300, type: 'alarm' });
  return segments;
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
  segments: ReturnType<typeof generateRecordingSegments>;
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
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onZoomOut} disabled={zoomLevel <= 1}>
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground font-mono">{zoomLevel}×</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onZoomIn} disabled={zoomLevel >= 16}>
          <ZoomIn className="h-3 w-3" />
        </Button>
        {isClipping && (
          <div className="flex items-center gap-1 ml-2">
            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onClipStartSet}>
              Set Start {clipStart !== null && `(${formatTime(clipStart)})`}
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onClipEndSet}>
              Set End {clipEnd !== null && `(${formatTime(clipEnd)})`}
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
        {segments.map((seg, i) => {
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
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-primary/25 rounded-sm" /> Continuous</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-warning/30 rounded-sm" /> Motion</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-destructive/30 rounded-sm" /> Alarm</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-destructive" /> Critical Event</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-warning" /> High</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-info" /> Info</span>
        {clipStart !== null && <span className="flex items-center gap-1"><span className="w-3 h-2 bg-primary/20 border border-primary rounded-sm" /> Clip Selection</span>}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function PlaybackPage() {
  const { data: devices = [], isLoading } = useDevices();
  const { data: sites = [] } = useSites();
  const { data: events = [] } = useEventsLegacy();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const cameras = devices.filter(d => d.type === 'camera');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('1');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(8 * 3600); // Start at 08:00
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isClipping, setIsClipping] = useState(false);
  const [clipStart, setClipStart] = useState<number | null>(null);
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');

  const device = cameras.find(d => d.id === selectedDevice) || cameras[0];
  const segments = useMemo(() => generateRecordingSegments(), []);

  // Filter events for the selected device and date
  const deviceEvents = useMemo(() => {
    if (!device) return [];
    return events.filter(e => {
      const eventDate = e.created_at.slice(0, 10);
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
      const { data, error } = await supabase
        .from('playback_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  // Create playback/export request
  const createExport = useMutation({
    mutationFn: async () => {
      if (!device || !user || !profile || clipStart === null || clipEnd === null) {
        throw new Error('Select a clip region first');
      }
      if (clipStart >= clipEnd) {
        throw new Error('Clip start must be before clip end');
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
      toast.success('Export request created. The clip will be processed by the gateway.');
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
    toast.success(`Snapshot captured at ${formatTime(currentTime)} from ${device?.name || 'camera'}`);
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left sidebar - Camera & Event list */}
      <div className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-3 border-b space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Camera</Label>
            {isLoading ? <Skeleton className="h-8 w-full" /> : (
              <Select value={selectedDevice || device?.id || ''} onValueChange={setSelectedDevice}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select camera" /></SelectTrigger>
                <SelectContent>
                  {cameras.map(d => (
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
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Channel</Label>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: device?.channels || 1 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>Channel {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</Label>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDateNav(-1)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setCurrentTime(0); setPlaying(false); }}
                className="h-8 text-xs flex-1"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDateNav(1)}>
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
            Events ({deviceEvents.length})
          </p>
          <Input
            placeholder="Search events..."
            value={eventSearchQuery}
            onChange={e => setEventSearchQuery(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1 space-y-0.5">
            {deviceEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">No events on this date</p>
            ) : deviceEvents.filter(evt => !eventSearchQuery || evt.title?.toLowerCase().includes(eventSearchQuery.toLowerCase()) || evt.event_type?.toLowerCase().includes(eventSearchQuery.toLowerCase())).map(evt => {
              const evtDate = new Date(evt.created_at);
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
                    <p className="text-[11px] font-medium truncate">{evt.title}</p>
                    <p className="text-[9px] text-muted-foreground">{formatTime(evtSeconds)} • {evt.event_type?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Export History */}
        <div className="p-2 border-t">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-1">
            Recent Exports ({playbackRequests.length})
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
        {/* Video area */}
        <div className="flex-1 relative bg-gradient-to-br from-muted/40 via-muted/20 to-muted/40 flex items-center justify-center">
          {!device ? (
            <div className="text-center">
              <Camera className="h-16 w-16 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Select a camera to begin playback</p>
            </div>
          ) : (
            <div className="text-center">
              <MonitorSpeaker className="h-20 w-20 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">{device.name} — Channel {selectedChannel}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                {selectedDate} • {formatTime(currentTime)}
              </p>
              <p className="text-[10px] text-muted-foreground/40 font-mono mt-2">
                {device.brand === 'hikvision' ? 'ISAPI Playback' : device.brand === 'dahua' ? 'NetSDK Playback' : 'RTSP/ONVIF'} •
                {isInRecording ? ' Recording Available' : ' No Recording'}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Badge variant={isInRecording ? 'default' : 'secondary'} className="text-[10px]">
                  {isInRecording ? '● Recording' : '○ Gap'}
                </Badge>
                {playing && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {speed}× {speed > 1 ? '▶▶' : speed < 1 ? '▶' : '▶'}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Overlay controls */}
          {device && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <Badge variant="outline" className="text-[9px] bg-background/60 backdrop-blur">
                  {device.brand} • {device.model}
                </Badge>
                <Badge variant="outline" className="text-[9px] bg-background/60 backdrop-blur font-mono">
                  CH{selectedChannel}
                </Badge>
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1">
                <Badge variant="outline" className="text-[9px] bg-background/60 backdrop-blur font-mono">
                  <Clock className="h-3 w-3 mr-1" />{formatTime(currentTime)}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7"><Maximize className="h-3.5 w-3.5" /></Button>
              </div>
            </>
          )}
        </div>

        {/* Transport controls */}
        <div className="border-t bg-card p-3 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevSpeed} title="Slower">
              <Rewind className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={skipBack} title="-30s">
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={skipForward} title="+30s">
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextSpeed} title="Faster">
              <FastForward className="h-3.5 w-3.5" />
            </Button>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Badge variant="outline" className="text-[10px] font-mono cursor-pointer" onClick={() => setSpeed(1)}>
              {speed}×
            </Badge>

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMuted(!muted)}>
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
                <Scissors className="mr-1 h-3 w-3" /> {isClipping ? 'Cancel Clip' : 'Clip'}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSnapshot}>
                <Image className="mr-1 h-3 w-3" /> Snapshot
              </Button>

              <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={clipStart === null || clipEnd === null}
                  >
                    <Download className="mr-1 h-3 w-3" /> Export Clip
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Export Video Clip</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="p-3 rounded-md bg-muted text-xs space-y-1">
                      <p><strong>Camera:</strong> {device?.name}</p>
                      <p><strong>Channel:</strong> {selectedChannel}</p>
                      <p><strong>Date:</strong> {selectedDate}</p>
                      <p><strong>Start:</strong> {clipStart !== null ? formatTime(clipStart) : '—'}</p>
                      <p><strong>End:</strong> {clipEnd !== null ? formatTime(clipEnd) : '—'}</p>
                      <p><strong>Duration:</strong> {clipStart !== null && clipEnd !== null ? formatTime(clipEnd - clipStart) : '—'}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The export request will be sent to the gateway for processing. 
                      Once ready, the clip will be available in the Export History panel.
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => createExport.mutate()}
                      disabled={createExport.isPending || clipStart === null || clipEnd === null}
                    >
                      {createExport.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                      Create Export Request
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
