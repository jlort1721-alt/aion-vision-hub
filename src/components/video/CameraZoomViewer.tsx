// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Visor de Cámara con Zoom
// Zoom (rueda/pinch), paneo (arrastrar) y controles
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CameraZoomViewerProps {
  src: string;
  alt?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const SCALE_STEP = 0.5;

export default function CameraZoomViewer({ src, alt = 'Captura' }: CameraZoomViewerProps) {
  const [scale, setScale] = useState(MIN_SCALE);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const pinchDist = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampScale = useCallback(
    (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)),
    [],
  );

  const reset = useCallback(() => {
    setScale(MIN_SCALE);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // ── Wheel zoom ──────────────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      setScale((s) => {
        const next = clampScale(s + delta);
        if (next === MIN_SCALE) setTranslate({ x: 0, y: 0 });
        return next;
      });
    },
    [clampScale],
  );

  // ── Mouse drag ──────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= MIN_SCALE) return;
      e.preventDefault();
      setIsDragging(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
    },
    [scale],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setTranslate((t) => ({ x: t.x + dx / scale, y: t.y + dy / scale }));
    },
    [isDragging, scale],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ── Touch: pinch-to-zoom + single-touch pan ─────────────
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist.current = Math.hypot(dx, dy);
      } else if (e.touches.length === 1 && scale > MIN_SCALE) {
        setIsDragging(true);
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    },
    [scale],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchDist.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const delta = (dist - pinchDist.current) * 0.01;
        pinchDist.current = dist;
        setScale((s) => clampScale(s + delta));
      } else if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - lastPos.current.x;
        const dy = e.touches[0].clientY - lastPos.current.y;
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setTranslate((t) => ({ x: t.x + dx / scale, y: t.y + dy / scale }));
      }
    },
    [isDragging, scale, clampScale],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    pinchDist.current = null;
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg bg-black" ref={containerRef}>
      <div
        style={{
          transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.2s',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="cursor-grab active:cursor-grabbing"
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-auto select-none"
          draggable={false}
        />
      </div>

      {/* Zoom indicator */}
      <Badge className="absolute top-2 right-2" variant="secondary">
        {Math.round(scale * 100)}%
      </Badge>

      {/* Controls overlay */}
      <div className="absolute bottom-2 right-2 flex gap-1">
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setScale((s) => clampScale(s + SCALE_STEP))}
          aria-label="Acercar"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={() => {
            const next = clampScale(scale - SCALE_STEP);
            setScale(next);
            if (next === MIN_SCALE) setTranslate({ x: 0, y: 0 });
          }}
          aria-label="Alejar"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={reset}
          aria-label="Restablecer"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
