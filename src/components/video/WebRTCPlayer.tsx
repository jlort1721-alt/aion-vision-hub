// ═══════════════════════════════════════════════════════════
// AION VISION HUB — WebRTC Player (MediaMTX Integration)
// Ultra-low latency camera streaming with HLS fallback
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, VideoOff, Maximize2, RefreshCw, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';

interface WebRTCPlayerProps {
  /** The unique camera stream ID (matched in MediaMTX) */
  streamId: string;
  /** Name of the camera to overlay */
  cameraName?: string;
  /** Whether the stream should play automatically */
  autoPlay?: boolean;
  /** Whether audio should be muted initially */
  muted?: boolean;
  /** Custom class name for the wrapper */
  className?: string;
  /** Edge Gateway WebRTC URL (MediaMTX WebRTC API endpoint) */
  webrtcUrl?: string;
  /** Fallback HLS URL if WebRTC fails */
  hlsUrl?: string;
  /** Action handler when clicked */
  onClick?: () => void;
  /** Show overlay controls */
  controls?: boolean;
}

export function WebRTCPlayer({
  streamId,
  cameraName,
  autoPlay = true,
  muted = true,
  className,
  webrtcUrl = import.meta.env.VITE_WEBRTC_URL || 'http://localhost:8889',
  hlsUrl,
  onClick,
  controls = true,
}: WebRTCPlayerProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'connecting' | 'playing' | 'error' | 'fallback'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [stats, setStats] = useState({ resolution: '', bitrate: 0, fps: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Connection Logic ───────────────────────────────────────

  const connectWebRTC = useCallback(async () => {
    if (!streamId || !videoRef.current) return;

    try {
      setStatus('connecting');
      setErrorMsg('');

      // Stop any existing connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      // Initialize WebRTC Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // Handle incoming tracks
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStatus('playing');
        }
      };

      // Add transceivers for receive only
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Create and set local offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to MediaMTX WebRTC API
      // MediaMTX expects POST /streamId/webrtc/offer
      const response = await fetch(`${webrtcUrl}/${streamId}/webrtc/offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type
        })
      });

      if (!response.ok) {
        throw new Error(`MediaMTX responded with ${response.status}: ${response.statusText}`);
      }

      const answer = await response.json();
      
      // Set remote answer from MediaMTX
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

    } catch (err: any) {
      console.error('[WebRTC] Connection error:', err);
      setErrorMsg(err.message || 'Stream connection failed');
      
      // Attempt HLS Fallback if configured
      if (hlsUrl) {
        setStatus('fallback');
        initHLSFallback();
      } else {
        setStatus('error');
      }
    }
  }, [streamId, webrtcUrl, hlsUrl]);

  // ── HLS Fallback ──────────────────────────────────────────

  const initHLSFallback = async () => {
    if (!videoRef.current || !hlsUrl) return;
    
    // Dynamic import of HLS.js mapping to the HLS endpoint
    try {
      const Hls = (await import('hls.js')).default;
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30, // seconds
        });
        hls.loadSource(`${hlsUrl}/${streamId}/index.m3u8`);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus('playing');
          if (autoPlay) videoRef.current?.play().catch(e => console.error('HLS Authplay blocked:', e));
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setStatus('error');
            setErrorMsg('HLS Fallback failed');
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari support
        videoRef.current.src = `${hlsUrl}/${streamId}/index.m3u8`;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setStatus('playing');
          if (autoPlay) videoRef.current?.play().catch(() => {});
        });
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('HLS not supported in this browser');
    }
  };

  // ── Lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    connectWebRTC();

    // Stats poller
    const statsInterval = setInterval(async () => {
      if (peerConnectionRef.current && status === 'playing') {
        try {
          const statsArray = await peerConnectionRef.current.getStats();
          statsArray.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              setStats(prev => ({
                ...prev,
                fps: report.framesPerSecond || prev.fps,
                // Roughly calculate kbps if bytesReceived changed
              }));
            }
            if (report.type === 'track' && report.kind === 'video') {
              setStats(prev => ({
                ...prev,
                resolution: `${report.frameWidth || 0}x${report.frameHeight || 0}`
              }));
            }
          });
        } catch (e) {
          // ignore stats errors
        }
      }
    }, 2000);

    return () => {
      clearInterval(statsInterval);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [connectWebRTC, status]);

  // ── Actions ────────────────────────────────────────────────

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    const elem = videoRef.current.parentElement;
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        toast.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const takeSnapshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current || status !== 'playing') return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      // Trigger download
      const link = document.createElement('a');
      link.download = `${cameraName || streamId}-${new Date().getTime()}.jpg`;
      link.href = dataUrl;
      link.click();
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <Card 
      className={cn("relative overflow-hidden bg-black flex items-center justify-center group cursor-pointer", className)}
      onClick={onClick}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        className={cn(
          "w-full h-full object-contain transition-opacity duration-300",
          status === 'playing' ? "opacity-100" : "opacity-0"
        )}
      />

      {/* State Overlays */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 text-white">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Connecting WebRTC</span>
        </div>
      )}

      {status === 'fallback' && (
        <div className="absolute top-2 left-2 z-20">
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 text-[9px] uppercase">
            HLS Fallback
          </Badge>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 text-destructive">
          <VideoOff className="w-10 h-10 mb-3 opacity-50" />
          <span className="text-sm font-medium">{errorMsg || 'Stream Offline'}</span>
          <Button variant="outline" size="sm" className="mt-4 bg-transparent border-input/20 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); connectWebRTC(); }}>
            <RefreshCw className="mr-2 h-3 w-3" /> Retry
          </Button>
        </div>
      )}

      {/* Camera Top Overlay */}
      {controls && (cameraName || status === 'playing') && (
        <div className="absolute top-0 inset-x-0 p-2 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20 flex justify-between items-start">
          <div className="flex gap-2 items-center">
            {status === 'playing' && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
            {cameraName && <span className="text-white text-xs font-medium drop-shadow-md">{cameraName}</span>}
          </div>
          
          <div className="flex flex-col items-end">
            <Badge variant="outline" className="text-[9px] text-white/80 border-white/20 bg-black/40 font-mono">
              {status === 'playing' ? `WEBRTC • ${stats.resolution} • ${Math.round(stats.fps)} fps` : status.toUpperCase()}
            </Badge>
          </div>
        </div>
      )}

      {/* Actions Bottom Overlay */}
      {controls && status === 'playing' && (
        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20 flex justify-end gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20 rounded-full" onClick={takeSnapshot} title="Take Snapshot">
            <Camera className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20 rounded-full" onClick={toggleFullscreen} title="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
