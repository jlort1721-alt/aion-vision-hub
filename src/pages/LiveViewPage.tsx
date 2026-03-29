import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

type GridSize = 4 | 9 | 16;

// ── WebRTC Camera Cell ───────────────────────────────────────

function CameraCell({
  camera,
  onDoubleClick,
}: {
  camera: Camera | null;
  onDoubleClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!camera || camera.status !== 'online') return;

    const videoEl = videoRef.current;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/go2rtc/api/ws?src=${camera.stream_key}`;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    pc.ontrack = (e) => {
      if (videoEl && e.streams[0]) {
        videoEl.srcObject = e.streams[0];
      }
    };

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Request WebRTC offer from go2rtc
      ws.send(JSON.stringify({ type: 'webrtc/offer', value: '' }));
    };

    ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'webrtc/offer') {
          await pc.setRemoteDescription({ type: 'offer', sdp: msg.value });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(
            JSON.stringify({ type: 'webrtc/answer', value: answer.sdp })
          );
        } else if (msg.type === 'webrtc/candidate') {
          await pc.addIceCandidate({
            candidate: msg.value,
            sdpMid: '0',
          });
        }
      } catch {
        // Silently handle malformed messages
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'webrtc/candidate',
            value: e.candidate.candidate,
          })
        );
      }
    };

    return () => {
      ws.close();
      pc.close();
      wsRef.current = null;
      pcRef.current = null;
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [camera]);

  const handleDoubleClick = useCallback(() => {
    if (!videoRef.current) return;
    if (onDoubleClick) {
      onDoubleClick();
    }
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  }, [onDoubleClick]);

  // Empty cell
  if (!camera) {
    return (
      <Card className="relative flex items-center justify-center bg-muted/30 border-dashed">
        <div className="text-center text-muted-foreground">
          <Video className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs opacity-50">No camera</p>
        </div>
      </Card>
    );
  }

  const isOnline = camera.status === 'online';

  return (
    <Card
      className="relative overflow-hidden bg-black border-border/50 group"
      onDoubleClick={handleDoubleClick}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Offline placeholder */}
      {!isOnline && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 z-10">
          <WifiOff className="h-8 w-8 text-destructive/60 mb-2" />
          <p className="text-xs text-muted-foreground">Offline</p>
        </div>
      )}

      {/* Bottom overlay with camera name */}
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

      {/* LIVE indicator for online cameras */}
      {isOnline && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-sm border border-white/10 z-20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] text-white/90 font-mono font-medium tracking-widest">
            LIVE
          </span>
        </div>
      )}
    </Card>
  );
}

// ── Main Page Component ──────────────────────────────────────

export default function LiveViewPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [gridSize, setGridSize] = useState<GridSize>(9);
  const [currentPage, setCurrentPage] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotateRef = useRef(autoRotate);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync for interval callback
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // ── Data Fetching ────────────────────────────────────────

  const {
    data: siteGroups = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SiteGroup[]>({
    queryKey: ['cameras-by-site'],
    queryFn: () => apiClient.get<SiteGroup[]>('/cameras/by-site'),
    enabled: !!profile,
    refetchInterval: 30_000,
  });

  const syncStatus = useMutation({
    mutationFn: () => apiClient.post('/cameras/sync-status'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras-by-site'] });
      toast.success('Camera status synced');
    },
    onError: (err: Error) => toast.error(`Sync failed: ${err.message}`),
  });

  // ── Derived Data ─────────────────────────────────────────

  const allCameras = useMemo(() => {
    return siteGroups.flatMap((sg) => sg.cameras);
  }, [siteGroups]);

  const filteredCameras = useMemo(() => {
    if (selectedSite === 'all') return allCameras;
    const group = siteGroups.find((sg) => sg.site_id === selectedSite);
    return group ? group.cameras : [];
  }, [allCameras, siteGroups, selectedSite]);

  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / gridSize));

  // Clamp page when filters or grid size change
  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

  // Reset page when site changes
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedSite, gridSize]);

  const paginatedCameras = useMemo(() => {
    const start = currentPage * gridSize;
    const slice = filteredCameras.slice(start, start + gridSize);
    // Pad with nulls to fill the grid
    const padded: (Camera | null)[] = [...slice];
    while (padded.length < gridSize) padded.push(null);
    return padded;
  }, [filteredCameras, currentPage, gridSize]);

  // ── Site Stats ───────────────────────────────────────────

  const siteStats = useMemo(() => {
    const stats: Record<string, { online: number; offline: number; total: number }> = {};
    siteGroups.forEach((sg) => {
      const online = sg.cameras.filter((c) => c.status === 'online').length;
      stats[sg.site_id] = {
        online,
        offline: sg.cameras.length - online,
        total: sg.cameras.length,
      };
    });
    // Aggregate "all"
    const allOnline = allCameras.filter((c) => c.status === 'online').length;
    stats['all'] = {
      online: allOnline,
      offline: allCameras.length - allOnline,
      total: allCameras.length,
    };
    return stats;
  }, [siteGroups, allCameras]);

  // ── Auto-Rotation Timer ──────────────────────────────────

  useEffect(() => {
    if (!autoRotate || totalPages <= 1) return;
    const interval = setInterval(() => {
      if (autoRotateRef.current) {
        setCurrentPage((prev) => (prev + 1) % totalPages);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [autoRotate, totalPages]);

  // ── Pagination Handlers ──────────────────────────────────

  const goToPrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  }, [totalPages]);

  // ── Fullscreen ───────────────────────────────────────────

  const toggleFullscreen = useCallback(() => {
    if (!gridContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      gridContainerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  // ── Grid Layout ──────────────────────────────────────────

  const cols = Math.sqrt(gridSize);

  const gridOptions: { size: GridSize; label: string }[] = [
    { size: 4, label: '2x2' },
    { size: 9, label: '3x3' },
    { size: 16, label: '4x4' },
  ];

  // ── Render ───────────────────────────────────────────────

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Card className="p-6 max-w-md text-center">
          <WifiOff className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h3 className="text-lg font-semibold mb-1">Failed to load cameras</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {(error as Error)?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* ── Site Sidebar ────────────────────────────────────── */}
        <div className="w-60 border-r bg-card flex flex-col shrink-0">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold tracking-tight">Sites</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Select a site to filter cameras
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {/* All Sites option */}
              <button
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm transition-colors ${
                  selectedSite === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedSite('all')}
              >
                <span className="font-medium truncate">All Sites</span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {siteStats['all'] && (
                    <>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${
                          selectedSite === 'all'
                            ? 'border-primary-foreground/30 text-primary-foreground'
                            : 'border-green-500/30 text-green-600'
                        }`}
                      >
                        <Wifi className="h-2.5 w-2.5 mr-0.5" />
                        {siteStats['all'].online}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${
                          selectedSite === 'all'
                            ? 'border-primary-foreground/30 text-primary-foreground'
                            : 'border-red-500/30 text-red-600'
                        }`}
                      >
                        <WifiOff className="h-2.5 w-2.5 mr-0.5" />
                        {siteStats['all'].offline}
                      </Badge>
                    </>
                  )}
                </div>
              </button>

              {/* Individual sites */}
              {siteGroups.map((sg) => {
                const stats = siteStats[sg.site_id];
                return (
                  <button
                    key={sg.site_id}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm transition-colors ${
                      selectedSite === sg.site_id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedSite(sg.site_id)}
                  >
                    <span className="font-medium truncate">{sg.site_name}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {stats && (
                        <>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 ${
                              selectedSite === sg.site_id
                                ? 'border-primary-foreground/30 text-primary-foreground'
                                : 'border-green-500/30 text-green-600'
                            }`}
                          >
                            <Wifi className="h-2.5 w-2.5 mr-0.5" />
                            {stats.online}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 ${
                              selectedSite === sg.site_id
                                ? 'border-primary-foreground/30 text-primary-foreground'
                                : 'border-red-500/30 text-red-600'
                            }`}
                          >
                            <WifiOff className="h-2.5 w-2.5 mr-0.5" />
                            {stats.offline}
                          </Badge>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}

              {siteGroups.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  No sites found
                </p>
              )}

              {isLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Sidebar footer with totals */}
          <div className="p-3 border-t text-xs text-muted-foreground">
            <p>
              {filteredCameras.length} camera{filteredCameras.length !== 1 ? 's' : ''}{' '}
              {selectedSite !== 'all' ? 'in site' : 'total'}
            </p>
          </div>
        </div>

        {/* ── Main Content ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0" ref={gridContainerRef}>
          {/* ── Controls Bar ──────────────────────────────────── */}
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-card">
            {/* Grid size selector */}
            <div
              className="flex items-center border rounded-md"
              role="group"
              aria-label="Grid layout options"
            >
              {gridOptions.map((opt) => (
                <Tooltip key={opt.size}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={gridSize === opt.size ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 px-3 rounded-none first:rounded-l-md last:rounded-r-md"
                      onClick={() => setGridSize(opt.size)}
                      aria-label={`${opt.label} grid layout`}
                      aria-pressed={gridSize === opt.size}
                    >
                      <Grid3X3 className="h-4 w-4 mr-1" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{opt.label} grid ({opt.size} cameras)</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={goToPrevPage}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous group</TooltipContent>
                </Tooltip>

                <span className="text-xs text-muted-foreground px-2 tabular-nums">
                  {currentPage + 1} / {totalPages}
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={goToNextPage}
                      disabled={currentPage >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next group</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Auto-rotation toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={autoRotate ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setAutoRotate(!autoRotate)}
                >
                  {autoRotate ? (
                    <Pause className="h-4 w-4 mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  <span className="text-xs">Auto</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {autoRotate
                  ? 'Stop auto-rotation (currently every 60s)'
                  : 'Auto-rotate camera groups every 60 seconds'}
              </TooltipContent>
            </Tooltip>

            <div className="ml-auto flex items-center gap-2">
              {/* Camera count */}
              <Badge variant="outline" className="text-xs">
                {filteredCameras.filter((c) => c.status === 'online').length}/
                {filteredCameras.length} online
              </Badge>

              {/* Sync Status */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => syncStatus.mutate()}
                    disabled={syncStatus.isPending}
                  >
                    {syncStatus.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    <span className="text-xs">Sync Status</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Refresh camera online/offline status
                </TooltipContent>
              </Tooltip>

              {/* Fullscreen */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={toggleFullscreen}
                  >
                    <Maximize className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle fullscreen</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ── Video Grid ────────────────────────────────────── */}
          <div className="flex-1 p-2 bg-background">
            {isLoading ? (
              <div
                className="grid gap-1.5 h-full"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${cols}, 1fr)`,
                }}
              >
                {Array.from({ length: gridSize }).map((_, i) => (
                  <Card
                    key={i}
                    className="flex items-center justify-center bg-muted/20 animate-pulse"
                  >
                    <Video className="h-8 w-8 text-muted-foreground/20" />
                  </Card>
                ))}
              </div>
            ) : (
              <div
                className="grid gap-1.5 h-full"
                style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${cols}, 1fr)`,
                }}
              >
                {paginatedCameras.map((camera, i) => (
                  <CameraCell key={camera?.id ?? `empty-${i}`} camera={camera} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
