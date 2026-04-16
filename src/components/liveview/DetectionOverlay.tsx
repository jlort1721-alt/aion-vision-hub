import { memo, useEffect, useRef } from "react";
import type { Detection } from "../../hooks/useDetectionStream";

interface DetectionOverlayProps {
  detections: Detection[];
  videoWidth: number;
  videoHeight: number;
}

const CLASS_COLORS: Record<string, string> = {
  person: "#3b82f6",
  vehicle: "#eab308",
  weapon: "#ef4444",
  intrusion: "#ef4444",
  fire: "#f97316",
  smoke: "#a855f7",
};

const DEFAULT_COLOR = "#6b7280";

function DetectionOverlayInner({
  detections,
  videoWidth,
  videoHeight,
}: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (detections.length === 0 && prevCountRef.current === 0) return;
    prevCountRef.current = detections.length;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const scaleX = rect.width / (videoWidth || 1);
    const scaleY = rect.height / (videoHeight || 1);
    const now = Date.now();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const det of detections) {
      const age = now - det.ts;
      const opacity = Math.max(0, 1 - age / det.ttlMs);
      if (opacity <= 0) continue;

      const x = det.bbox.x * scaleX;
      const y = det.bbox.y * scaleY;
      const w = det.bbox.w * scaleX;
      const h = det.bbox.h * scaleY;

      const color = CLASS_COLORS[det.label] ?? DEFAULT_COLOR;

      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      const label = `${det.label} ${Math.round(det.confidence * 100)}%`;
      ctx.font = "bold 11px Inter, sans-serif";
      const metrics = ctx.measureText(label);
      const labelH = 16;
      const labelW = metrics.width + 8;

      ctx.fillStyle = color;
      ctx.fillRect(x, y - labelH, labelW, labelH);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x + 4, y - 4);
    }

    ctx.globalAlpha = 1;
  }, [detections, videoWidth, videoHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}

export const DetectionOverlay = memo(DetectionOverlayInner);
