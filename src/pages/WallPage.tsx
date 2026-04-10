import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
  Maximize,
  Minimize,
  AlertTriangle,
  Info,
  ShieldAlert,
  Siren,
  Save,
  FolderOpen,
  Star,
  Trash2,
  LayoutGrid,
} from "lucide-react";
import { SmartCameraCell } from "@/components/video/SmartCameraCell";
import { useI18n } from "@/contexts/I18nContext";

// ── Types ──────────────────────────────────────────────────

interface Camera {
  id: string;
  name: string;
  stream_key: string;
  status: "online" | "offline" | "degraded" | "unknown" | "maintenance";
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

type GridSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10;

// SmartCameraCell handles all stream types — no snapshot-only prefixes needed

// ── Severity helpers ───────────────────────────────────────

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "bg-red-600 text-white";
    case "high":
      return "bg-orange-500 text-white";
    case "medium":
      return "bg-yellow-500 text-black";
    case "low":
      return "bg-blue-500 text-white";
    default:
      return "bg-zinc-600 text-white";
  }
}

function severityIcon(severity: string) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return <Siren className="w-3 h-3" />;
    case "high":
      return <ShieldAlert className="w-3 h-3" />;
    case "medium":
      return <AlertTriangle className="w-3 h-3" />;
    default:
      return <Info className="w-3 h-3" />;
  }
}

// ── Event Item ─────────────────────────────────────────────

function EventItem({
  event,
  onClick,
}: {
  event: DeviceEvent;
  onClick: () => void;
}) {
  const time = new Date(event.createdAt).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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
        {event.siteName} {event.cameraName ? `- ${event.cameraName}` : ""}
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
      {now.toLocaleTimeString("es-CR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  );
}

// ── Main WallPage ──────────────────────────────────────────

export default function WallPage() {
  const { t } = useI18n();
  const { screenNumber } = useParams<{ screenNumber: string }>();
  const screen = parseInt(screenNumber || "1", 10);
  const { isAuthenticated } = useAuth();

  // ── State ──
  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [isPaused, setIsPaused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(120); // 2 minutes per group
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState("");
  const progressBarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // ── Layouts ──

  interface SavedLayout {
    id: string;
    name: string;
    grid: number;
    slots: string[];
    is_favorite: boolean;
  }

  const { data: savedLayouts = [] } = useQuery<SavedLayout[]>({
    queryKey: ["wall-layouts"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SavedLayout[] }>(
        "/live-view/layouts",
      );
      return res?.data ?? [];
    },
    enabled: isAuthenticated,
  });

  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      const name =
        newLayoutName.trim() ||
        `Layout ${gridSize}x${gridSize} - ${new Date().toLocaleString("es-CO")}`;
      const slots = displayCameras
        .filter(Boolean)
        .map((c) => c?.stream_key ?? "");
      return apiClient.post("/live-view/layouts", {
        name,
        grid: gridSize,
        slots,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wall-layouts"] });
      setNewLayoutName("");
      setLayoutMenuOpen(false);
      toast.success("Layout guardado");
    },
    onError: () => toast.error("Error al guardar layout"),
  });

  const deleteLayoutMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/live-view/layouts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wall-layouts"] });
      toast.success("Layout eliminado");
    },
  });

  const loadLayout = useCallback((layout: SavedLayout) => {
    setGridSize(layout.grid as GridSize);
    setLayoutMenuOpen(false);
    toast.success(`Layout "${layout.name}" cargado`);
  }, []);

  // ── Data fetching ──

  const { data: siteGroups = [] } = useQuery<SiteGroup[]>({
    queryKey: ["wall-cameras-by-site", screen],
    queryFn: async () => {
      const res = await apiClient.get<unknown>("/cameras/by-site");
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
    queryKey: ["wall-events"],
    queryFn: async () => {
      const res = await apiClient.get<unknown>("/device-events", {
        limit: "50",
      });
      if (Array.isArray(res)) return res as DeviceEvent[];
      const r = res as Record<string, unknown>;
      if (Array.isArray(r.items)) return r.items as DeviceEvent[];
      if (Array.isArray(r.data)) return r.data as DeviceEvent[];
      return [];
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
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
  const totalCameras = siteGroups.reduce(
    (sum, sg) => sum + sg.cameras.length,
    0,
  );

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

  // ── Rotation timer (CSS-driven progress bar, single timeout) ──

  useEffect(() => {
    if (isPaused || totalGroups <= 1) return;

    const bar = progressBarRef.current;
    if (bar) {
      bar.style.transition = "none";
      bar.style.width = "0%";
      void bar.offsetWidth;
      bar.style.transition = `width ${rotationSpeed}s linear`;
      bar.style.width = "100%";
    }

    const id = setTimeout(() => {
      setCurrentGroupIndex((prev) => (prev + 1) % totalGroups);
    }, rotationSpeed * 1000);

    return () => clearTimeout(id);
  }, [isPaused, totalGroups, rotationSpeed, currentGroupIndex]);

  // ── Navigation ──

  const goNext = useCallback(() => {
    setCurrentGroupIndex((prev) => (prev + 1) % totalGroups);
  }, [totalGroups]);

  const goPrev = useCallback(() => {
    setCurrentGroupIndex((prev) => (prev - 1 + totalGroups) % totalGroups);
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
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Kiosk mode ──

  const enableKiosk = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        const lock = await navigator.wakeLock.request("screen");
        setWakeLock(lock);
      }
    } catch {
      /* wake lock not supported or denied */
    }
    setKioskMode(true);
    setSidebarOpen(false);
    try {
      await containerRef.current?.requestFullscreen();
    } catch {
      /* fullscreen denied */
    }
  }, []);

  const disableKiosk = useCallback(async () => {
    setKioskMode(false);
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch {}
      setWakeLock(null);
    }
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
  }, [wakeLock]);

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "Space") {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "Escape") {
        if (kioskMode) {
          disableKiosk();
        } else {
          setFocusedCameraId(null);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleFullscreen, goNext, goPrev, kioskMode, disableKiosk]);

  // ── Focus camera from event click ──

  const focusCameraFromEvent = useCallback((event: DeviceEvent) => {
    if (event.camera_id) {
      setFocusedCameraId(event.camera_id);
    }
  }, []);

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
      style={{ background: "#030810" }}
    >
      {/* ── Kiosk exit overlay ── */}
      {kioskMode && (
        <button
          onClick={disableKiosk}
          className="fixed top-3 right-3 z-50 px-3 py-1.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-mono font-semibold text-white/80 tracking-wider opacity-30 hover:opacity-100 transition-opacity"
        >
          {t("wall.exit_kiosk")}
        </button>
      )}

      {/* ── Toolbar ─────────────────────────────────── */}
      {!kioskMode && (
        <div className="flex items-center justify-between h-12 px-3 border-b border-white/5 shrink-0 bg-[#030810]/95 backdrop-blur-sm z-30">
          {/* Left: Brand */}
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#D4A017]" />
            <span className="text-sm font-bold text-white tracking-wider">
              AION{" "}
              <span className="text-[#D4A017]">{t("wall.monitoring")}</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono ml-2">
              P{screen}
            </span>
          </div>

          {/* Center: Controls */}
          <div className="flex items-center gap-1">
            {/* Layout buttons */}
            {([2, 3, 4, 5, 6, 7, 8, 10] as GridSize[]).map((size) => (
              <button
                key={size}
                onClick={() => {
                  setGridSize(size);
                  setFocusedCameraId(null);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  gridSize === size && !focusedCameraId
                    ? "bg-[#D4A017] text-black font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
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
              aria-label="Grupo anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPaused((p) => !p)}
              className={`p-1 rounded transition-colors ${
                isPaused
                  ? "text-[#D4A017] bg-[#D4A017]/10"
                  : "text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
              title={isPaused ? "Resume (Space)" : "Pause (Space)"}
              aria-label={isPaused ? "Reanudar rotación" : "Pausar rotación"}
            >
              {isPaused ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={goNext}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Next group (Right arrow)"
              aria-label="Grupo siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-white/10 mx-1" />

            {/* Speed slider */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500">
                {rotationSpeed}s
              </span>
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
            {/* Layout manager */}
            <div className="relative">
              <button
                onClick={() => setLayoutMenuOpen((o) => !o)}
                className={`p-1 rounded transition-colors ${layoutMenuOpen ? "text-[#D4A017] bg-[#D4A017]/10" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}
                title="Layouts guardados"
                aria-label="Gestionar layouts"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              {layoutMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-[#0a1628] border border-white/10 rounded-lg shadow-2xl z-50 p-2">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 px-1">
                    Layouts Guardados
                  </div>
                  {savedLayouts.length === 0 && (
                    <div className="text-xs text-zinc-600 text-center py-3">
                      Sin layouts guardados
                    </div>
                  )}
                  {savedLayouts.map((layout) => (
                    <div
                      key={layout.id}
                      className="flex items-center gap-1 px-1 py-1.5 rounded hover:bg-white/5 group"
                    >
                      <button
                        onClick={() => loadLayout(layout)}
                        className="flex-1 text-left text-xs text-zinc-300 truncate"
                      >
                        {layout.name}
                      </button>
                      <span className="text-[9px] text-zinc-600">
                        {layout.grid}x{layout.grid}
                      </span>
                      <button
                        onClick={() => deleteLayoutMutation.mutate(layout.id)}
                        className="p-0.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="border-t border-white/5 mt-2 pt-2">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Nombre del layout..."
                        value={newLayoutName}
                        onChange={(e) => setNewLayoutName(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4A017]/50"
                        onKeyDown={(e) =>
                          e.key === "Enter" && saveLayoutMutation.mutate()
                        }
                      />
                      <button
                        onClick={() => saveLayoutMutation.mutate()}
                        className="px-2 py-1 text-[10px] bg-[#D4A017] text-black rounded font-bold hover:bg-[#D4A017]/80"
                        disabled={saveLayoutMutation.isPending}
                      >
                        <Save className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Toggle event sidebar"
              aria-label="Panel de eventos"
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
                  ? "text-[#D4A017] bg-[#D4A017]/10"
                  : "text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
              title="Toggle sound alerts"
              aria-label={
                soundEnabled ? "Silenciar alertas" : "Activar alertas sonoras"
              }
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
              aria-label="Pantalla completa"
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
              display: "grid",
              gridTemplateColumns: `repeat(${effectiveGridSize}, 1fr)`,
              gridTemplateRows: `repeat(${effectiveGridSize}, 1fr)`,
            }}
          >
            {gridCells.map((cam, i) => (
              <SmartCameraCell
                key={cam?.id ?? `empty-${i}`}
                camera={cam}
                variant="wall"
                isFocused={cam?.id === focusedCameraId}
                forceSnapshot={effectiveGridSize > 5}
                snapshotInterval={
                  effectiveGridSize > 7
                    ? 5_000
                    : effectiveGridSize > 5
                      ? 3_000
                      : 15_000
                }
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
                ref={progressBarRef}
                className="h-full"
                style={{ width: "0%", background: "#D4A017" }}
              />
            </div>
          )}
        </div>

        {/* Event Sidebar */}
        {sidebarOpen && (
          <div className="w-[280px] border-l border-white/5 flex flex-col bg-[#040b14] shrink-0">
            <div className="flex items-center justify-between px-3 h-9 border-b border-white/5">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                {t("wall.events")}
              </span>
              <span className="text-[10px] text-zinc-600 font-mono">
                {events.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              {events.length === 0 && (
                <div className="flex items-center justify-center h-32 text-zinc-600 text-xs">
                  {t("wall.no_events")}
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
