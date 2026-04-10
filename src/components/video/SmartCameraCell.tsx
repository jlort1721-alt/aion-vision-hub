import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Video, WifiOff, Image, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useIntersectionVideo } from '@/hooks/use-intersection-video';

export interface SmartCamera {
  id: string;
  name: string;
  stream_key: string;
  status: string;
  site_name?: string;
}

interface SmartCameraCellProps {
  camera: SmartCamera | null;
  isSelected?: boolean;
  isFocused?: boolean;
  variant?: 'liveview' | 'wall';
  onClick?: () => void;
  onDoubleClick?: () => void;
  /** Force video mode (skip snapshot-first) */
  forceVideo?: boolean;
  /** Snapshot refresh interval in ms (default 10000) */
  snapshotInterval?: number;
}

type CellMode = 'idle' | 'snapshot' | 'video';

/** Max concurrent video streams across all SmartCameraCell instances */
const MAX_CONCURRENT_STREAMS = 9;
const activeStreams = new Set<string>();

function SmartCameraCellInner({
  camera,
  isSelected = false,
  isFocused = false,
  variant = 'liveview',
  onClick,
  onDoubleClick,
  forceVideo = false,
  snapshotInterval = 10_000,
}: SmartCameraCellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const timerRef = useRef<number>(0);
  const { containerRef, isVisible } = useIntersectionVideo<HTMLDivElement>();
  const [mode, setMode] = useState<CellMode>('idle');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const retryTimerRef = useRef<number>(0);

  const streamKey = camera?.stream_key ?? '';
  const isOnline = camera?.status === 'online' || camera?.status === 'active';

  // ── Determine target mode based on visibility ──
  // Always try video when visible + online. If stream limit hit, fall back to snapshot.
  const targetMode: CellMode = !camera || !isOnline ? 'idle'
    : !isVisible ? 'idle'
    : 'video';

  // ── Snapshot polling ──
  useEffect(() => {
    if (targetMode !== 'snapshot' || !streamKey) return;
    setMode('snapshot');
    const refreshFrame = () => {
      if (imgRef.current) {
        imgRef.current.src = `/snapshots/${encodeURIComponent(streamKey)}.jpg?t=${Date.now()}`;
      }
    };
    refreshFrame();
    timerRef.current = window.setInterval(refreshFrame, snapshotInterval);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = 0;
    };
  }, [targetMode, streamKey, snapshotInterval]);

  // ── Video stream ──
  useEffect(() => {
    if (targetMode !== 'video' || !streamKey) return;

    // Check concurrent stream limit
    if (!activeStreams.has(streamKey) && activeStreams.size >= MAX_CONCURRENT_STREAMS) {
      setMode('snapshot');
      return;
    }

    setMode('video');
    activeStreams.add(streamKey);

    const video = videoRef.current;
    if (!video) return;
    video.src = `/go2rtc/api/stream.mp4?src=${encodeURIComponent(streamKey)}`;
    video.play().catch(() => {});

    const handleError = () => {
      activeStreams.delete(streamKey);
      setStreamFailed(true);
      setMode('snapshot');
      // Auto-retry after 30s
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = window.setTimeout(() => {
        setStreamFailed(false);
      }, 30_000);
    };
    const handleStall = () => {
      setTimeout(() => {
        if (video.readyState < 2) {
          activeStreams.delete(streamKey);
          setMode('snapshot');
        }
      }, 5000);
    };
    video.addEventListener('error', handleError);
    video.addEventListener('stalled', handleStall);

    return () => {
      video.removeEventListener('error', handleError);
      video.removeEventListener('stalled', handleStall);
      video.src = '';
      video.load();
      activeStreams.delete(streamKey);
    };
  }, [targetMode, streamKey]);

  // ── Cleanup when idle ──
  useEffect(() => {
    if (targetMode !== 'idle') return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = 0;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = 0;
    const video = videoRef.current;
    if (video && video.src) {
      video.src = '';
      video.load();
    }
    activeStreams.delete(streamKey);
    setMode('idle');
    setImgLoaded(false);
    setStreamFailed(false);
  }, [targetMode, streamKey]);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.();
    const el = containerRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
  }, [onDoubleClick, containerRef]);

  const captureSnapshot = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const canvas = document.createElement('canvas');
      const source = mode === 'video' ? videoRef.current : imgRef.current;
      if (!source) return;
      if (mode === 'video' && videoRef.current) {
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      } else if (imgRef.current) {
        canvas.width = imgRef.current.naturalWidth || 640;
        canvas.height = imgRef.current.naturalHeight || 480;
        canvas.getContext('2d')?.drawImage(imgRef.current, 0, 0);
      }
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/jpeg', 0.92);
      a.download = `${camera?.name ?? 'cam'}-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      a.click();
      toast.success(`Captura: ${camera?.name}`);
    },
    [mode, camera],
  );

  // ── Empty cell ──
  if (!camera) {
    const emptyClass =
      variant === 'wall'
        ? 'relative flex items-center justify-center bg-[#060d18] border border-white/5 rounded'
        : 'relative flex items-center justify-center bg-muted/30 border-dashed';
    return (
      <div ref={containerRef} className={emptyClass}>
        <div className="text-center text-muted-foreground">
          <Video className="h-6 w-6 mx-auto mb-1 opacity-30" />
          <p className="text-[10px] opacity-40">Sin cámara</p>
        </div>
      </div>
    );
  }

  // ── Sizing classes by variant ──
  const isWall = variant === 'wall';
  const borderClass = isWall
    ? isFocused
      ? 'border-[#D4A017] shadow-[0_0_12px_rgba(212,160,23,0.3)]'
      : 'border-white/5 hover:border-white/20'
    : isSelected
      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
      : '';

  const Container = isWall ? 'div' : Card;

  return (
    <Container
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={`relative overflow-hidden bg-black border rounded cursor-pointer transition-all group ${borderClass}`}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Skeleton loader */}
      {mode === 'idle' && isOnline && (
        <div className="absolute inset-0 bg-zinc-900 animate-pulse" />
      )}

      {/* Snapshot image (hidden behind video, always present as fallback) */}
      <img
        ref={imgRef}
        alt={camera.name}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          imgLoaded && mode !== 'video' ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgLoaded(false)}
      />

      {/* Video stream */}
      {mode === 'video' && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          playsInline
        />
      )}

      {/* Stream failed overlay */}
      {isOnline && streamFailed && !imgLoaded && mode === 'snapshot' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 z-10">
          <Camera className={`${isWall ? 'h-5 w-5' : 'h-7 w-7'} text-muted-foreground/40 mb-1.5`} />
          <p className={`${isWall ? 'text-[9px]' : 'text-[11px]'} text-muted-foreground font-medium`}>{camera.name}</p>
          <p className={`${isWall ? 'text-[8px]' : 'text-[10px]'} text-muted-foreground/60 mt-0.5`}>Stream no disponible</p>
        </div>
      )}

      {/* Offline overlay */}
      {!isOnline && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 z-10">
          <WifiOff className={`${isWall ? 'h-6 w-6' : 'h-8 w-8'} text-destructive/60 mb-1`} />
          <p className={`${isWall ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Offline</p>
        </div>
      )}

      {/* Camera name bar */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/90 to-transparent z-20 pointer-events-none">
        <div className="flex items-center gap-1">
          <span
            className={`${isWall ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full shrink-0 ${
              isOnline
                ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]'
            }`}
          />
          <span
            className={`${isWall ? 'text-[10px]' : 'text-xs'} font-medium text-white truncate drop-shadow-md`}
          >
            {camera.name}
          </span>
        </div>
      </div>

      {/* Mode badge + capture button */}
      {isOnline && (
        <>
          <div
            className={`absolute ${isWall ? 'top-1 right-1' : 'top-1.5 right-1.5'} flex items-center gap-0.5 px-1 py-px rounded-sm bg-black/60 backdrop-blur-sm border border-white/10 z-20`}
          >
            {mode === 'video' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className={`${isWall ? 'text-[8px]' : 'text-[9px]'} text-white/90 font-mono font-medium tracking-widest`}>
                  LIVE
                </span>
              </>
            ) : (
              <>
                <Image className="w-2.5 h-2.5 text-yellow-400" />
                <span className={`${isWall ? 'text-[8px]' : 'text-[9px]'} text-yellow-300/90 font-mono font-medium tracking-widest`}>
                  SNAP
                </span>
              </>
            )}
          </div>

          {!isWall && (
            <button
              className="absolute top-1.5 left-1.5 p-1 rounded-sm bg-black/60 backdrop-blur-sm border border-white/10 z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
              title="Capturar imagen"
              onClick={captureSnapshot}
            >
              <Camera className="h-3.5 w-3.5 text-white" />
            </button>
          )}
        </>
      )}
    </Container>
  );
}

export const SmartCameraCell = memo(SmartCameraCellInner);
