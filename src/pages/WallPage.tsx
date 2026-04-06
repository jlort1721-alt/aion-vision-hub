import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Shield,
  Grid2X2,
  Grid3X3,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose,
  Volume2,
  VolumeX,
  Video,
  WifiOff,
  Maximize,
  Minimize,
  AlertTriangle,
  Info,
  ShieldAlert,
  Siren,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

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

interface DeviceEvent {
  id: string;
  severity: string;
  eventType: string;
  description?: string;
  createdAt: string;
  siteName?: string;
  cameraName?: string;
  deviceName?: string;
  camera_id?: string;
}

type GridSize = 2 | 3 | 4 | 5;

const SDK_ONLY_PREFIXES = ['ss-', 'ag-', 'pq-', 'tl-', 'se-', 'ar-', 'br-'];
const isSnapshotOnly = (key: string) =>
  SDK_ONLY_PREFIXES.some((p) => key.startsWith(p));

// ── Severity helpers ───────────────────────────────────────

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'bg-red-600 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    case 'low': return 'bg-blue-500 text-white';
    default: return 'bg-zinc-600 text-white';
  }
}

function severityIcon(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical': return <Siren className="w-3 h-3" />;
    case 'high': return <ShieldAlert className="w-3 h-3" />;
    case 'medium': return <AlertTriangle className="w-3 h-3" />;
    default: return <Info className="w-3 h-3" />;
  }
}

// ── Wall Camera Cell ───────────────────────────────────────

function WallCameraCell({
  camera,
  isFocused,
  onClick,
}: {
  camera: Camera | null;
  isFocused: boolean;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const timerRef = useRef<number>(0);
  const [mode, setMode] = useState<'video' | 'snapshot' | 'init'>('init');

  useEffect(() => {
    if (!camera || camera.status !== 'online') return;
    setMode(isSnapshotOnly(camera.stream_key) ? 'snapshot' : 'video');
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [camera]);

  // Snapshot refresh
  useEffect(() => {
    if (!camera || camera.status !== 'online' || mode !== 'snapshot') return;
    const key = camera.stream_key;
    const refreshFrame = () => {
      if (imgRef.current)
        imgRef.current.src = `/snapshots/${encodeURIComponent(key)}.jpg?t=${Date.now()}`;
    };
    refreshFrame();
    timerRef.current = window.setInterval(refreshFrame, 5000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [camera, mode]);

  // Video stream
  useEffect(() => {
    if (!camera || camera.status !== 'online' || mode !== 'video') return;
    const video = videoRef.current;
    if (!video) return;
    const key = camera.stream_key;
    video.src = `/go2rtc/api/stream.mp4?src=${encodeURIComponent(key)}`;
    video.play().catch(() => {});
    const handleError = () => setMode('snapshot');
    const handleStall = () => {
      setTimeout(() => {
        if (video.readyState < 2) setMode('snapshot');
      }, 5000);
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

  if (!camera) {
    return (
      <div className="relative flex items-center justify-center bg-[#060d18] border border-white/5 rounded">
        <div className="text-center text-zinc-600">
          <Video className="h-6 w-6 mx-auto mb-1 opacity-30" />
          <p className="text-[10px] opacity-40">Sin senal</p>
        </div>
      </div>
    );
  }

  const isOnline = camera.status === 'online';

  return (
    <div
      className={`relative overflow-hidden bg-black border rounded cursor-pointer transition-all ${
        isFocused
          ? 'border-[#D4A017] shadow-[0_0_12px_rgba(212,160,23,0.3)]'
          : 'border-white/5 hover:border-white/20'
      }`}
      onClick={onClick}
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
          <WifiOff className="h-6 w-6 text-red-500/60 mb-1" />
          <p className="text-[10px] text-zinc-500">Offline</p>
        </div>
      )}

      {/* Camera name overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/90 to-transparent z-20 pointer-events-none">
        <div className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isOnline
                ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]'
            }`}
          />
          <span className="text-[10px] font-medium text-white truncate drop-shadow-md">
            {camera.name}
          </span>
        </div>
      </div>

      {/* LIVE badge */}
      {isOnline && (
        <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-px rounded-sm bg-black/60 backdrop-blur-sm border border-white/10 z-20">
          <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] text-white/80 font-mono font-medium tracking-widest">
            LIVE
          </span>
        </div>
      )}
    </div>
  );
}

// ── Event Item ─────────────────────────────────────────────

function EventItem({
  event,
  onClick,
}: {
  event: DeviceEvent;
  onClick: () => void;
}) {
  const time = new Date(event.createdAt).toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 transition-colors"
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[10px] text-zinc-500 font-mono">{time}</span>
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-semibold ${severityColor(
            event.severity,
          )}`}
        >
          {severityIcon(event.severity)}
          {event.severity?.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-zinc-300 truncate">
        {event.description || event.eventType}
      </p>
      <p className="text-[10px] text-zinc-500 truncate">
        {event.siteName} {event.cameraName ? `- ${event.cameraName}` : ''}
      </p>
    </button>
  );
}

// ── Live Clock ─────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-sm font-mono text-zinc-300 tabular-nums">
      {now.toLocaleTimeString('es-CR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}
    </span>
  );
}

// ── Main WallPage ──────────────────────────────────────────

export default function WallPage() {
  const { screenNumber } = useParams<{ screenNumber: string }>();
  const screen = parseInt(screenNumber || '1', 10);
  const { isAuthenticated } = useAuth();

  // ── State ──
  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [isPaused, setIsPaused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(30); // seconds
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const progressRef = useRef<number>(0);
  const [progressPct, setProgressPct] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──

  const { data: siteGroups = [] } = useQuery<SiteGroup[]>({
    queryKey: ['wall-cameras-by-site', screen],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/cameras/by-site');
      if (Array.isArray(res)) return res as SiteGroup[];
      const r = res as Record<string, unknown>;
      if (Array.isArray(r.items)) return r.items as SiteGroup[];
      if (Array.isArray(r.data)) return r.data as SiteGroup[];
      return [];
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const { data: events = [] } = useQuery<DeviceEvent[]>({
    queryKey: ['wall-events'],
    queryFn: async () => {
      const res = await apiClient.get<unknown>('/device-events', { limit: '50' });
      if (Array.isArray(res)) return res as DeviceEvent[];
      const r = res as Record<string, unknown>;
      if (Array.isArray(r.items)) return r.items as DeviceEvent[];
      if (Array.isArray(r.data)) return r.data as DeviceEvent[];
      return [];
    },
    enabled: isAuthenticated,
    refetchInterval: 10_000,
  });

  // ── Flatten cameras by groups for rotation ──

  const cameraGroups = useMemo(() => {
    const cellsPerPage = gridSize * gridSize;
    const allCameras: Camera[] = siteGroups.flatMap((sg) => sg.cameras);
    const groups: Camera[][] = [];
    for (let i = 0; i < allCameras.length; i += cellsPerPage) {
      groups.push(allCameras.slice(i, i + cellsPerPage));
    }
    return groups.length > 0 ? groups : [[]];
  }, [siteGroups, gridSize]);

  const totalGroups = cameraGroups.length;
  const totalCameras = siteGroups.reduce((sum, sg) => sum + sg.cameras.length, 0);

  // ── Focused camera overrides grid ──

  const displayCameras = useMemo(() => {
    if (focusedCameraId) {
      const all = siteGroups.flatMap((sg) => sg.cameras);
      const cam = all.find((c) => c.id === focusedCameraId);
      return cam ? [cam] : cameraGroups[currentGroupIndex] || [];
    }
    return cameraGroups[currentGroupIndex] || [];
  }, [focusedCameraId, cameraGroups, currentGroupIndex, siteGroups]);

  const effectiveGridSize = focusedCameraId ? 1 : gridSize;

  // ── Rotation timer ──

  useEffect(() => {
    if (isPaused || totalGroups <= 1) {
      setProgressPct(0);
      return;
    }
    const intervalMs = 100;
    const totalTicks = (rotationSpeed * 1000) / intervalMs;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      setProgressPct((tick / totalTicks) * 100);
      if (tick >= totalTicks) {
        tick = 0;
        setCurrentGroupIndex((prev) => (prev + 1) % totalGroups);
      }
    }, intervalMs);
    progressRef.current = id as unknown as number;
    return () => clearInterval(id);
  }, [isPaused, totalGroups, rotationSpeed, currentGroupIndex]);

  // ── Navigation ──

  const goNext = useCallback(() => {
    setCurrentGroupIndex((prev) => (prev + 1) % totalGroups);
    setProgressPct(0);
  }, [totalGroups]);

  const goPrev = useCallback(() => {
    setCurrentGroupIndex((prev) => (prev - 1 + totalGroups) % totalGroups);
    setProgressPct(0);
  }, [totalGroups]);

  // ── Fullscreen ──

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Kiosk mode ──

  const enableKiosk = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
      }
    } catch { /* wake lock not supported or denied */ }
    setKioskMode(true);
    setSidebarOpen(false);
    try {
      await containerRef.current?.requestFullscreen();
    } catch { /* fullscreen denied */ }
  }, []);

  const disableKiosk = useCallback(async () => {
    setKioskMode(false);
    if (wakeLock) {
      try { await wakeLock.release(); } catch {}
      setWakeLock(null);
    }
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
  }, [wakeLock]);

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'Escape') {
        if (kioskMode) {
          disableKiosk();
        } else {
          setFocusedCameraId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFullscreen, goNext, goPrev, kioskMode, disableKiosk]);

  // ── Focus camera from event click ──

  const focusCameraFromEvent = useCallback(
    (event: DeviceEvent) => {
      if (event.camera_id) {
        setFocusedCameraId(event.camera_id);
      }
    },
    [],
  );

  // ── Grid cells (pad to fill grid) ──

  const gridCells = useMemo(() => {
    const cells: (Camera | null)[] = [...displayCameras];
    const total = effectiveGridSize * effectiveGridSize;
    while (cells.length < total) cells.push(null);
    return cells;
  }, [displayCameras, effectiveGridSize]);

  // ── Render ──

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-screen h-screen overflow-hidden select-none"
      style={{ background: '#030810' }}
    >
      {/* ── Kiosk exit overlay ── */}
      {kioskMode && (
        <button
          onClick={disableKiosk}
          className="fixed top-3 right-3 z-50 px-3 py-1.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-mono font-semibold text-white/80 tracking-wider opacity-30 hover:opacity-100 transition-opacity"
        >
          EXIT KIOSK
        </button>
      )}

      {/* ── Toolbar ─────────────────────────────────── */}
      {!kioskMode && (
      <div className="flex items-center justify-between h-12 px-3 border-b border-white/5 shrink-0 bg-[#030810]/95 backdrop-blur-sm z-30">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#D4A017]" />
          <span className="text-sm font-bold text-white tracking-wider">
            AION <span className="text-[#D4A017]">MONITOREO</span>
          </span>
          <span className="text-[10px] text-zinc-500 font-mono ml-2">
            P{screen}
          </span>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-1">
          {/* Layout buttons */}
          {([2, 3, 4, 5] as GridSize[]).map((size) => (
            <button
              key={size}
              onClick={() => {
                setGridSize(size);
                setFocusedCameraId(null);
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                gridSize === size && !focusedCameraId
                  ? 'bg-[#D4A017] text-black font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
              title={`${size}x${size} grid`}
            >
              {size}x{size}
            </button>
          ))}

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Prev / Pause / Next */}
          <button
            onClick={goPrev}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Previous group (Left arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPaused((p) => !p)}
            className={`p-1 rounded transition-colors ${
              isPaused
                ? 'text-[#D4A017] bg-[#D4A017]/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
            title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={goNext}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Next group (Right arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Speed slider */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500">{rotationSpeed}s</span>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={rotationSpeed}
              onChange={(e) => setRotationSpeed(Number(e.target.value))}
              className="w-16 h-1 accent-[#D4A017] cursor-pointer"
            />
          </label>

          {/* Group indicator */}
          <span className="text-[10px] text-zinc-500 font-mono ml-2">
            {currentGroupIndex + 1}/{totalGroups}
          </span>
        </div>

        {/* Right: Toggles & Info */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Toggle event sidebar"
          >
            {sidebarOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => setSoundEnabled((s) => !s)}
            className={`p-1 rounded transition-colors ${
              soundEnabled
                ? 'text-[#D4A017] bg-[#D4A017]/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle sound alerts"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          <span className="text-[10px] text-zinc-500 font-mono">
            {totalCameras} cam
          </span>

          <LiveClock />

          <button
            onClick={enableKiosk}
            className="px-2 py-1 rounded text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Kiosk mode (hides toolbar, prevents screen sleep)"
          >
            KIOSK
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Fullscreen (F11)"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      )}

      {/* ── Body: Grid + Sidebar ────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Video Grid */}
        <div className="flex-1 p-1 min-h-0 relative">
          <div
            className="w-full h-full gap-1"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${effectiveGridSize}, 1fr)`,
              gridTemplateRows: `repeat(${effectiveGridSize}, 1fr)`,
            }}
          >
            {gridCells.map((cam, i) => (
              <WallCameraCell
                key={cam?.id ?? `empty-${i}`}
                camera={cam}
                isFocused={cam?.id === focusedCameraId}
                onClick={() => {
                  if (cam) {
                    setFocusedCameraId(
                      focusedCameraId === cam.id ? null : cam.id,
                    );
                  }
                }}
              />
            ))}
          </div>

          {/* ── Rotation progress bar ── */}
          {!isPaused && totalGroups > 1 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
              <div
                className="h-full transition-[width] duration-100 ease-linear"
                style={{
                  width: `${progressPct}%`,
                  background: '#D4A017',
                }}
              />
            </div>
          )}
        </div>

        {/* Event Sidebar */}
        {sidebarOpen && (
          <div className="w-[280px] border-l border-white/5 flex flex-col bg-[#040b14] shrink-0">
            <div className="flex items-center justify-between px-3 h-9 border-b border-white/5">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Eventos
              </span>
              <span className="text-[10px] text-zinc-600 font-mono">
                {events.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              {events.length === 0 && (
                <div className="flex items-center justify-center h-32 text-zinc-600 text-xs">
                  Sin eventos recientes
                </div>
              )}
              {events.map((ev) => (
                <EventItem
                  key={ev.id}
                  event={ev}
                  onClick={() => focusCameraFromEvent(ev)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
