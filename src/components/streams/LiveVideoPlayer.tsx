import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertCircle,
  Camera,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Circle,
  WifiOff,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StreamFormat = "hls" | "mse" | "webrtc" | "rtsp";
type StreamQuality = "main" | "sub" | "third" | "auto";
type StreamStatus = "idle" | "loading" | "playing" | "error" | "offline";

interface LiveVideoPlayerProps {
  deviceId: string;
  deviceName?: string;
  channel: number;
  defaultFormat?: StreamFormat;
  defaultQuality?: StreamQuality;
  showPTZ?: boolean;
  autoPlay?: boolean;
  className?: string;
  height?: number | string;
  compact?: boolean; // minimal controls for wall view
  onClick?: () => void;
}

interface PlaybackResponse {
  success: boolean;
  data?: {
    device_id: string;
    device_name: string;
    channel: number;
    quality: string;
    format: string;
    stream_key: string;
    playback_url: string;
  };
  error?: string;
  candidates?: string[];
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export function LiveVideoPlayer({
  deviceId,
  deviceName,
  channel,
  defaultFormat = "hls",
  defaultQuality = "sub",
  showPTZ = false,
  autoPlay = true,
  className = "",
  height = 240,
  compact = false,
  onClick,
}: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const [format, setFormat] = useState<StreamFormat>(defaultFormat);
  const [quality, setQuality] = useState<StreamQuality>(defaultQuality);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [bitrate, setBitrate] = useState<number | null>(null);

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        // noop
      }
      hlsRef.current = null;
    }
  }, []);

  const fetchPlaybackUrl = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const resp = await apiClient.get<PlaybackResponse>(
        `/api/streams/${deviceId}/channel/${channel}/playback?format=${format}&quality=${quality}`,
      );
      if (!resp.success || !resp.data?.playback_url) {
        const candidates = resp.candidates?.join(", ") ?? "";
        throw new Error(resp.error ?? `Sin stream (tried: ${candidates})`);
      }
      setStreamKey(resp.data.stream_key);
      setPlaybackUrl(resp.data.playback_url);
      retryCountRef.current = 0;
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      setStatus(msg.includes("404") ? "offline" : "error");
      setPlaybackUrl(null);
    }
  }, [deviceId, channel, format, quality]);

  useEffect(() => {
    fetchPlaybackUrl();
  }, [fetchPlaybackUrl, reloadKey]);

  const scheduleRetry = useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) {
      setStatus("error");
      return;
    }
    retryCountRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      setReloadKey((k) => k + 1);
    }, RETRY_DELAY_MS * retryCountRef.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    cleanup();

    if (format === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          liveDurationInfinity: true,
          liveMaxLatencyDurationCount: 5,
          maxBufferLength: 4,
          maxMaxBufferLength: 8,
          backBufferLength: 4,
          maxLiveSyncPlaybackRate: 1.5,
          liveSyncDurationCount: 2,
        });
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus("playing");
        });
        hls.on(Hls.Events.FRAG_LOADED, (_evt, data) => {
          if (
            data.frag.stats?.loading?.end &&
            data.frag.stats?.loading?.start
          ) {
            const bitrateMbps =
              ((data.payload as ArrayBuffer).byteLength * 8) /
              (data.frag.duration * 1024 * 1024);
            setBitrate(bitrateMbps);
          }
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Red inestable — reintentando");
              scheduleRetry();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              try {
                hls.recoverMediaError();
              } catch {
                scheduleRetry();
              }
              break;
            default:
              setError(`${data.type}: ${data.details}`);
              scheduleRetry();
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playbackUrl;
        video.addEventListener("loadedmetadata", () => setStatus("playing"));
        video.addEventListener("error", () => {
          setError("HLS native playback failed");
          scheduleRetry();
        });
      } else {
        setError("HLS no soportado en este navegador");
        setStatus("error");
      }
    } else {
      // MSE/WebRTC → go2rtc HTML player page; para cumplir MVP mostramos HLS fallback
      setFormat("hls");
    }

    return cleanup;
  }, [playbackUrl, format, cleanup, scheduleRetry]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay || !playbackUrl) return;
    video.muted = muted;
    video.play().catch(() => {
      // Browser autoplay blocked
    });
  }, [playbackUrl, autoPlay, muted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {
      // User denied
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const ptzCommand = useCallback(
    async (action: string) => {
      try {
        await apiClient.post(
          `/api/streams/${deviceId}/channel/${channel}/ptz`,
          {
            action,
            speed: 4,
            duration_ms: 500,
          },
        );
        toast.success(`PTZ ${action}`);
      } catch (err) {
        toast.error(`PTZ: ${(err as Error).message}`);
      }
    },
    [deviceId, channel],
  );

  const statusIcon = {
    idle: <Circle className="h-2 w-2 fill-gray-400" />,
    loading: <Circle className="h-2 w-2 fill-amber-400 animate-pulse" />,
    playing: <Circle className="h-2 w-2 fill-emerald-500" />,
    error: <Circle className="h-2 w-2 fill-red-500" />,
    offline: <WifiOff className="h-3 w-3 text-red-400" />,
  }[status];

  return (
    <Card className={cn("overflow-hidden", className)} onClick={onClick}>
      {!compact && (
        <CardHeader className="pb-2 px-3 py-2">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <CardTitle className="flex items-center gap-2 text-xs font-medium">
              {statusIcon}
              <Camera className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[140px]">
                {deviceName ?? deviceId.slice(0, 8)}
              </span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                Ch {channel}
              </Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Select
                value={quality}
                onValueChange={(v) => setQuality(v as StreamQuality)}
              >
                <SelectTrigger className="h-6 w-14 text-[10px] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub">SD</SelectItem>
                  <SelectItem value="main">HD</SelectItem>
                  <SelectItem value="third">LD</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  retryCountRef.current = 0;
                  setReloadKey((k) => k + 1);
                }}
                title="Reconectar"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3",
                    status === "loading" && "animate-spin",
                  )}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0 relative bg-black">
        <div
          ref={containerRef}
          className="relative bg-black group"
          style={{
            height: typeof height === "number" ? `${height}px` : height,
          }}
        >
          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs z-10">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Cargando stream…
            </div>
          )}
          {(status === "error" || status === "offline") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 text-xs p-2 text-center z-10 bg-black/70">
              {status === "offline" ? (
                <WifiOff className="h-6 w-6 mb-1" />
              ) : (
                <AlertCircle className="h-6 w-6 mb-1" />
              )}
              <p className="max-w-[90%] break-words">
                {status === "offline" ? "Device offline" : error}
              </p>
              {retryCountRef.current < MAX_RETRIES && (
                <p className="text-[10px] text-red-300 mt-1">
                  Retry {retryCountRef.current}/{MAX_RETRIES}…
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  retryCountRef.current = 0;
                  setReloadKey((k) => k + 1);
                }}
              >
                Reintentar
              </Button>
            </div>
          )}
          <video
            ref={videoRef}
            className="w-full h-full object-contain bg-black"
            muted={muted}
            playsInline
            controls={false}
          />
          {status === "playing" && (
            <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded flex items-center gap-1">
              <Circle className="h-1.5 w-1.5 fill-red-500 animate-pulse" />
              LIVE
              {bitrate && <span>· {bitrate.toFixed(1)} Mbps</span>}
            </div>
          )}
          {compact && (
            <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded">
              {statusIcon}
              <span className="ml-1">
                {deviceName?.slice(0, 12)} Ch{channel}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
            >
              {videoRef.current?.paused ? (
                <Play className="h-3 w-3" />
              ) : (
                <Pause className="h-3 w-3" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
            >
              {muted ? (
                <VolumeX className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </Button>
            <div className="flex-1" />
            {showPTZ && status === "playing" && (
              <div className="flex gap-0.5">
                {(
                  [
                    "up",
                    "down",
                    "left",
                    "right",
                    "zoom_in",
                    "zoom_out",
                  ] as const
                ).map((a) => {
                  const Icon = {
                    up: ArrowUp,
                    down: ArrowDown,
                    left: ArrowLeft,
                    right: ArrowRight,
                    zoom_in: ZoomIn,
                    zoom_out: ZoomOut,
                  }[a];
                  return (
                    <Button
                      key={a}
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        ptzCommand(a);
                      }}
                    >
                      <Icon className="h-3 w-3" />
                    </Button>
                  );
                })}
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
            >
              {fullscreen ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
