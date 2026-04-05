// ═══════════════════════════════════════════════════════════
// AION VISION HUB — go2rtc Video Player
// Supports MSE (WebSocket), MP4 stream, and WebRTC
// Works with H.264 and H.265 (HEVC) cameras
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, Loader2, VideoOff, Maximize2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Go2RTCPlayerProps {
  /** Stream name as configured in go2rtc (e.g. "portalegre-ch1") */
  streamName: string;
  /** Display name overlay */
  cameraName?: string;
  /** go2rtc base URL */
  go2rtcUrl?: string;
  /** Auto-play on mount */
  autoPlay?: boolean;
  /** Muted by default */
  muted?: boolean;
  /** Custom class */
  className?: string;
  /** Show controls */
  controls?: boolean;
}

type PlayerStatus = 'idle' | 'connecting' | 'playing' | 'error';

const GO2RTC_BASE = import.meta.env.VITE_GO2RTC_URL || '/go2rtc';

export function Go2RTCPlayer({
  streamName,
  cameraName,
  go2rtcUrl = GO2RTC_BASE,
  autoPlay = true,
  muted = true,
  className,
  controls = true,
}: Go2RTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const bufferQueue = useRef<ArrayBuffer[]>([]);

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // ── MSE (MediaSource Extensions) via WebSocket ────────
  const connectMSE = useCallback(() => {
    if (!videoRef.current || !streamName) return;

    setStatus('connecting');
    setErrorMsg('');

    // Determine WebSocket URL
    const wsBase = (go2rtcUrl || '').replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/ws?src=${streamName}`;

    try {
      const ms = new MediaSource();
      mediaSourceRef.current = ms;
      videoRef.current.src = URL.createObjectURL(ms);

      ms.addEventListener('sourceopen', () => {
        // go2rtc sends fMP4 with codec info in first frame
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        let mimeType = '';
        let sourceBuffer: SourceBuffer | null = null;

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            // First message is JSON with codec info
            try {
              const info = JSON.parse(event.data);
              // go2rtc sends: {"type":"mse","value":{"codecs":"avc1.640029"}}
              // or for HEVC: {"type":"mse","value":{"codecs":"hev1.1.6.L120.90"}}
              if (info.type === 'mse' && info.value?.codecs) {
                mimeType = `video/mp4; codecs="${info.value.codecs}"`;
                if (MediaSource.isTypeSupported(mimeType)) {
                  sourceBuffer = ms.addSourceBuffer(mimeType);
                  sourceBufferRef.current = sourceBuffer;
                  sourceBuffer.mode = 'segments';
                  sourceBuffer.addEventListener('updateend', () => {
                    if (bufferQueue.current.length > 0 && !sourceBuffer!.updating) {
                      sourceBuffer!.appendBuffer(bufferQueue.current.shift()!);
                    }
                    // Keep buffer small for low latency
                    if (videoRef.current && sourceBuffer!.buffered.length > 0) {
                      const end = sourceBuffer!.buffered.end(0);
                      const start = sourceBuffer!.buffered.start(0);
                      if (end - start > 5) {
                        sourceBuffer!.remove(start, end - 3);
                      }
                    }
                  });
                } else {
                  // Browser doesn't support this codec (e.g. HEVC on Chrome)
                  // Fall back to MP4 stream
                  ws.close();
                  connectMP4();
                  return;
                }
              }
            } catch { /* not JSON, ignore */ }
            return;
          }

          // Binary data = fMP4 segment
          if (sourceBuffer && !sourceBuffer.updating) {
            try {
              sourceBuffer.appendBuffer(event.data);
            } catch {
              bufferQueue.current.push(event.data);
            }
          } else {
            bufferQueue.current.push(event.data);
            // Limit queue size
            if (bufferQueue.current.length > 30) {
              bufferQueue.current = bufferQueue.current.slice(-10);
            }
          }

          if (status !== 'playing') {
            setStatus('playing');
            if (autoPlay && videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }
        };

        ws.onerror = () => {
          setStatus('error');
          setErrorMsg('WebSocket connection failed');
        };

        ws.onclose = () => {
          if (status === 'playing') {
            // Auto-reconnect after 3 seconds
            setTimeout(() => connectMSE(), 3000);
          }
        };
      });
    } catch (err) {
      connectMP4(); // Fallback
    }
  }, [streamName, go2rtcUrl, autoPlay, status]);

  // ── MP4 Stream fallback (works with any codec) ────────
  const connectMP4 = useCallback(() => {
    if (!videoRef.current || !streamName) return;
    setStatus('connecting');
    // go2rtc serves a continuous MP4 stream
    videoRef.current.src = `${go2rtcUrl}/api/stream.mp4?src=${streamName}`;
    videoRef.current.muted = muted;
    if (autoPlay) {
      videoRef.current.play().then(() => setStatus('playing')).catch(() => {
        setStatus('error');
        setErrorMsg('Playback blocked by browser');
      });
    }
  }, [streamName, go2rtcUrl, autoPlay, muted]);

  // ── Lifecycle ─────────────────────────────────────────
  useEffect(() => {
    if (autoPlay && streamName) {
      // Try MSE first (lower latency), fall back to MP4
      if (typeof MediaSource !== 'undefined') {
        connectMSE();
      } else {
        connectMP4();
      }
    }

    return () => {
      wsRef.current?.close();
      if (mediaSourceRef.current?.readyState === 'open') {
        try { mediaSourceRef.current.endOfStream(); } catch { /* ignore */ }
      }
      bufferQueue.current = [];
    };
  }, [streamName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    wsRef.current?.close();
    bufferQueue.current = [];
    if (typeof MediaSource !== 'undefined') {
      connectMSE();
    } else {
      connectMP4();
    }
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div className={cn('relative w-full h-full bg-black', className)}>
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        className="w-full h-full object-contain"
      />

      {/* Status overlays */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
          <span className="text-xs text-muted-foreground">Conectando...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
          <VideoOff className="h-6 w-6 text-destructive mb-2" />
          <span className="text-xs text-destructive mb-2">{errorMsg || 'Sin señal'}</span>
          <Button variant="outline" size="sm" onClick={handleRetry} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Reintentar
          </Button>
        </div>
      )}

      {status === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
          <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground">Stream no configurado</span>
        </div>
      )}

      {/* Camera name overlay */}
      {controls && cameraName && status === 'playing' && (
        <div className="absolute top-0 left-0 right-0 p-1.5 bg-gradient-to-b from-black/70 to-transparent z-10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-white/90 truncate">{cameraName}</span>
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 text-green-400 border-green-400/30 bg-green-400/10">
              LIVE
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}

export default Go2RTCPlayer;
