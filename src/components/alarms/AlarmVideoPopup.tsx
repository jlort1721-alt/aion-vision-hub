// ================================================================
// AION VISION HUB -- Alarm Video Popup
// Floating, draggable popup that shows the camera feed when a
// critical/high severity event arrives via WebSocket.
// Stacks up to 3 popups; auto-dismisses after 60 s.
// ================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Go2RTCPlayer } from '@/components/video/Go2RTCPlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Check, Maximize2, GripHorizontal, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDevices } from '@/hooks/use-devices';
import { toast } from 'sonner';
import type { EventSeverity } from '@/types';

// -- Types --------------------------------------------------------

interface AlarmPopupEntry {
  id: string;
  device_id: string;
  device_name: string;
  stream_name: string;
  severity: EventSeverity;
  title: string;
  description: string;
  site_name: string;
  timestamp: string;
  fullscreen: boolean;
}

const MAX_POPUPS = 3;
const AUTO_DISMISS_MS = 60_000;

// -- Single Popup Card --------------------------------------------

function AlarmPopupCard({
  alarm,
  index,
  onAcknowledge,
  onDismiss,
  onToggleFullscreen,
}: {
  alarm: AlarmPopupEntry;
  index: number;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onToggleFullscreen: (id: string) => void;
}) {
  const dragRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Stagger position so popups don't overlap
  const baseBottom = 16 + index * 260;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const severityColor = alarm.severity === 'critical'
    ? 'bg-red-600 text-white'
    : 'bg-orange-500 text-white';

  if (alarm.fullscreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-black">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-white font-semibold text-sm">{alarm.title}</span>
            <Badge className={cn('text-[10px]', severityColor)}>
              {(alarm.severity || 'unknown').toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAcknowledge(alarm.id)}>
              <Check className="h-3 w-3 mr-1" /> Acknowledge
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onToggleFullscreen(alarm.id)}>
              <Maximize2 className="h-3 w-3 mr-1" /> Exit Fullscreen
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={() => onDismiss(alarm.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 relative">
          <Go2RTCPlayer
            streamName={alarm.stream_name}
            cameraName={alarm.device_name}
          />
        </div>
        <div className="px-4 py-2 bg-black text-xs text-white/60 flex items-center gap-4">
          <span>{alarm.description}</span>
          <span>{alarm.site_name}</span>
          <span>{new Date(alarm.timestamp).toLocaleString()}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dragRef}
      className={cn(
        'fixed z-[100] w-80 rounded-lg border shadow-2xl overflow-hidden bg-card',
        'animate-in slide-in-from-right-10 duration-300',
        alarm.severity === 'critical' ? 'border-red-600/60 shadow-red-900/30' : 'border-orange-500/60 shadow-orange-900/30',
      )}
      style={{
        right: 16 - pos.x,
        bottom: baseBottom - pos.y,
      }}
    >
      {/* Drag handle + header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 cursor-grab active:cursor-grabbing select-none',
          alarm.severity === 'critical' ? 'bg-red-600/90' : 'bg-orange-500/90',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <GripHorizontal className="h-3.5 w-3.5 text-white/60 shrink-0" />
        <AlertTriangle className="h-3.5 w-3.5 text-white shrink-0" />
        <span className="text-xs font-semibold text-white truncate flex-1">{alarm.title}</span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-white border-white/30 bg-white/10">
          {(alarm.severity || 'unknown').toUpperCase()}
        </Badge>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-white/80 hover:text-white hover:bg-white/20 p-0" onClick={() => onDismiss(alarm.id)}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Video player */}
      <div className="relative h-44 bg-black">
        <Go2RTCPlayer
          streamName={alarm.stream_name}
          cameraName={alarm.device_name}
          controls={false}
        />
      </div>

      {/* Info bar */}
      <div className="px-3 py-2 border-t space-y-1">
        <p className="text-[11px] text-muted-foreground truncate">{alarm.description}</p>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate">{alarm.site_name} &middot; {alarm.device_name}</span>
          <span className="shrink-0">{new Date(alarm.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t bg-muted/30">
        <Button variant="default" size="sm" className="h-6 text-[10px] flex-1" onClick={() => onAcknowledge(alarm.id)}>
          <Check className="h-3 w-3 mr-1" /> Acknowledge
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => onDismiss(alarm.id)}>
          Dismiss
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => onToggleFullscreen(alarm.id)}>
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// -- Main Container -----------------------------------------------

export default function AlarmVideoPopup() {
  const [alarms, setAlarms] = useState<AlarmPopupEntry[]>([]);
  const { data: devices = [] } = useDevices();
  const { subscribe } = useWebSocket();
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Build a lookup map from device id to device info
  const deviceMap = useRef<Map<string, { name: string; slug: string; site_id: string }>>(new Map());
  useEffect(() => {
    const map = new Map<string, { name: string; slug: string; site_id: string }>();
    for (const d of devices) {
      map.set(d.id, {
        name: d.name,
        slug: (d as unknown as Record<string, unknown>).device_slug as string || d.id,
        site_id: d.site_id,
      });
    }
    deviceMap.current = map;
  }, [devices]);

  // Schedule auto-dismiss
  const scheduleAutoDismiss = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setAlarms((prev) => prev.filter((a) => a.id !== id));
      timersRef.current.delete(id);
    }, AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
  }, []);

  // Listen for critical / high events via WebSocket
  useEffect(() => {
    const unsubscribe = subscribe('events', (msg) => {
      const payload = msg.payload as { type?: string; event?: Record<string, unknown> };
      if (payload.type !== 'event.new' || !payload.event) return;

      const evt = payload.event;
      const severity = evt.severity as EventSeverity;
      if (severity !== 'critical' && severity !== 'high') return;

      const deviceId = evt.device_id as string;
      const info = deviceMap.current.get(deviceId);

      const entry: AlarmPopupEntry = {
        id: evt.id as string,
        device_id: deviceId,
        device_name: info?.name || 'Unknown Camera',
        stream_name: info?.slug || deviceId,
        severity,
        title: (evt.title as string) || 'Alarm',
        description: (evt.description as string) || (evt.event_type as string)?.replace(/_/g, ' ') || '',
        site_name: info?.site_id || '',
        timestamp: (evt.created_at as string) || new Date().toISOString(),
        fullscreen: false,
      };

      setAlarms((prev) => {
        // Don't duplicate
        if (prev.some((a) => a.id === entry.id)) return prev;
        const next = [entry, ...prev];
        // Keep max 3
        if (next.length > MAX_POPUPS) {
          const removed = next.pop();
          if (removed) {
            const t = timersRef.current.get(removed.id);
            if (t) clearTimeout(t);
            timersRef.current.delete(removed.id);
          }
        }
        return next;
      });

      scheduleAutoDismiss(entry.id);
    });

    return () => {
      unsubscribe();
      // Clear all timers
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [scheduleAutoDismiss, subscribe]);

  // Handlers
  const handleDismiss = useCallback((id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
  }, []);

  const handleAcknowledge = useCallback((id: string) => {
    toast.success('Alarm acknowledged');
    handleDismiss(id);
  }, [handleDismiss]);

  const handleToggleFullscreen = useCallback((id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, fullscreen: !a.fullscreen } : a)),
    );
  }, []);

  if (alarms.length === 0) return null;

  return (
    <>
      {alarms.map((alarm, i) => (
        <AlarmPopupCard
          key={alarm.id}
          alarm={alarm}
          index={i}
          onAcknowledge={handleAcknowledge}
          onDismiss={handleDismiss}
          onToggleFullscreen={handleToggleFullscreen}
        />
      ))}
    </>
  );
}
