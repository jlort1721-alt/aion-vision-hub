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
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

type StreamFormat = "hls" | "mse" | "webrtc" | "rtsp";
type StreamQuality = "main" | "sub" | "third" | "auto";

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

export function LiveVideoPlayer({
  deviceId,
  deviceName,
  channel,
  defaultFormat = "hls",
  defaultQuality = "sub",
  showPTZ = false,
  autoPlay = true,
  className = "",
  height = 360,
}: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [format, setFormat] = useState<StreamFormat>(defaultFormat);
  const [quality, setQuality] = useState<StreamQuality>(defaultQuality);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchPlaybackUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.get<PlaybackResponse>(
        `/api/streams/${deviceId}/channel/${channel}/playback?format=${format}&quality=${quality}`,
      );
      if (!resp.success || !resp.data?.playback_url) {
        const candidates = resp.candidates?.join(", ") ?? "";
        throw new Error(
          resp.error ?? `No stream available (tried: ${candidates})`,
        );
      }
      setStreamKey(resp.data.stream_key);
      setPlaybackUrl(resp.data.playback_url);
    } catch (err) {
      setError((err as Error).message);
      setPlaybackUrl(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, channel, format, quality]);

  useEffect(() => {
    fetchPlaybackUrl();
  }, [fetchPlaybackUrl, reloadKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (format === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls({
          lowLatencyMode: true,
          liveDurationInfinity: true,
          liveMaxLatencyDurationCount: 5,
          maxBufferLength: 10,
          backBufferLength: 10,
        });
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            setError(`HLS ${data.type}: ${data.details}`);
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playbackUrl;
      } else {
        setError("HLS not supported in this browser");
      }
    } else if (format === "mse" || format === "webrtc") {
      // go2rtc publica un HTML player en la misma URL sin ?src=. Para integración
      // plena MSE necesitaríamos sources buffer management; para simplicidad, HLS
      // es el fallback robusto.
      setError(`Format ${format} UI integration pending — use HLS for now`);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playbackUrl, format]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay || !playbackUrl) return;
    video.muted = muted;
    const tryPlay = async () => {
      try {
        await video.play();
        setPlaying(true);
      } catch {
        // Autoplay blocked — user must interact
      }
    };
    tryPlay();
  }, [playbackUrl, autoPlay, muted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
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
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
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
        toast.success(`PTZ ${action} enviado`);
      } catch (err) {
        toast.error(`PTZ failed: ${(err as Error).message}`);
      }
    },
    [deviceId, channel],
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4" />
            {deviceName ?? deviceId.slice(0, 8)} — Ch {channel}
            {streamKey && (
              <Badge variant="secondary" className="text-xs">
                {streamKey}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            <Select
              value={quality}
              onValueChange={(v) => setQuality(v as StreamQuality)}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sub">SD</SelectItem>
                <SelectItem value="main">HD</SelectItem>
                <SelectItem value="third">480p</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as StreamFormat)}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hls">HLS</SelectItem>
                <SelectItem value="mse">MSE</SelectItem>
                <SelectItem value="webrtc">WebRTC</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              <RefreshCw
                className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="relative bg-black group"
          style={{
            height: typeof height === "number" ? `${height}px` : height,
          }}
        >
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 text-sm p-4 text-center">
              <AlertCircle className="h-8 w-8 mb-2" />
              {error}
            </div>
          )}
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Cargando
              stream…
            </div>
          )}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            muted={muted}
            playsInline
            controls={false}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/10"
              onClick={togglePlay}
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/10"
              onClick={toggleMute}
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1" />
            {showPTZ && (
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white hover:bg-white/10"
                  onClick={() => ptzCommand("up")}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white hover:bg-white/10"
                  onClick={() => ptzCommand("down")}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white hover:bg-white/10"
                  onClick={() => ptzCommand("left")}
                >
                  <ArrowLeft className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white hover:bg-white/10"
                  onClick={() => ptzCommand("right")}
                >
                  <ArrowRight className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white hover:bg-white/10"
                  onClick={() => ptzCommand("zoom_in")}
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white hover:bg-white/10"
                  onClick={() => ptzCommand("zoom_out")}
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/10"
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
