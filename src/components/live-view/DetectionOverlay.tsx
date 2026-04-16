import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Detection } from '@/hooks/use-mediapipe-detection';

// ── Types ─────────────────────────────────────────────────────
interface DetectionOverlayProps {
  detections: Detection[];
  videoElement: HTMLVideoElement | null;
  className?: string;
}

// ── Color map by detection label ──────────────────────────────
const LABEL_COLORS: Record<string, string> = {
  person: 'rgba(59,130,246,0.4)',
  vehicle: 'rgba(34,197,94,0.4)',
  car: 'rgba(34,197,94,0.4)',
  truck: 'rgba(34,197,94,0.4)',
  bus: 'rgba(34,197,94,0.4)',
  motorcycle: 'rgba(34,197,94,0.4)',
  bicycle: 'rgba(34,197,94,0.4)',
  animal: 'rgba(234,179,8,0.4)',
  cat: 'rgba(234,179,8,0.4)',
  dog: 'rgba(234,179,8,0.4)',
  bird: 'rgba(234,179,8,0.4)',
  horse: 'rgba(234,179,8,0.4)',
};

const DEFAULT_COLOR = 'rgba(168,85,247,0.4)';

const LABEL_STROKE_COLORS: Record<string, string> = {
  person: 'rgba(59,130,246,0.9)',
  vehicle: 'rgba(34,197,94,0.9)',
  car: 'rgba(34,197,94,0.9)',
  truck: 'rgba(34,197,94,0.9)',
  bus: 'rgba(34,197,94,0.9)',
  motorcycle: 'rgba(34,197,94,0.9)',
  bicycle: 'rgba(34,197,94,0.9)',
  animal: 'rgba(234,179,8,0.9)',
  cat: 'rgba(234,179,8,0.9)',
  dog: 'rgba(234,179,8,0.9)',
  bird: 'rgba(234,179,8,0.9)',
  horse: 'rgba(234,179,8,0.9)',
};

const DEFAULT_STROKE_COLOR = 'rgba(168,85,247,0.9)';

function getColor(label: string): string {
  return LABEL_COLORS[label.toLowerCase()] ?? DEFAULT_COLOR;
}

function getStrokeColor(label: string): string {
  return LABEL_STROKE_COLORS[label.toLowerCase()] ?? DEFAULT_STROKE_COLOR;
}

// ── Component ─────────────────────────────────────────────────
export function DetectionOverlay({ detections, videoElement, className }: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const drawDetections = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas to actual video display size
    const rect = videoElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Scale factors: model detects on videoWidth/videoHeight, display is rect size
    const videoWidth = videoElement.videoWidth || 1;
    const videoHeight = videoElement.videoHeight || 1;
    const scaleX = rect.width / videoWidth;
    const scaleY = rect.height / videoHeight;

    for (const detection of detections) {
      const { x, y, width, height } = detection.boundingBox;
      const drawX = x * scaleX;
      const drawY = y * scaleY;
      const drawW = width * scaleX;
      const drawH = height * scaleY;

      const fillColor = getColor(detection.label);
      const strokeColor = getStrokeColor(detection.label);

      // Filled rectangle
      ctx.fillStyle = fillColor;
      ctx.fillRect(drawX, drawY, drawW, drawH);

      // Border
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);

      // Label with confidence
      const labelText = `${detection.label} ${Math.round(detection.confidence * 100)}%`;
      ctx.font = '12px Inter, system-ui, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const textHeight = 16;
      const padding = 4;

      // Label background
      const labelY = Math.max(drawY - textHeight - padding, 0);
      ctx.fillStyle = strokeColor;
      ctx.fillRect(drawX, labelY, textMetrics.width + padding * 2, textHeight + padding);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, drawX + padding, labelY + textHeight);
    }
  }, [detections, videoElement]);

  // Redraw on detection changes
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      drawDetections();
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [drawDetections]);

  // Handle video resize
  useEffect(() => {
    if (!videoElement) return;

    const observer = new ResizeObserver(() => {
      drawDetections();
    });

    observer.observe(videoElement);

    return () => {
      observer.disconnect();
    };
  }, [videoElement, drawDetections]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden="true"
    />
  );
}
