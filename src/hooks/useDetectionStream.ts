import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket } from "./use-websocket";

export interface Detection {
  id: string;
  bbox: { x: number; y: number; w: number; h: number };
  label: string;
  confidence: number;
  ts: number;
  ttlMs: number;
}

const DEFAULT_TTL = 3000;
const MAX_DETECTIONS = 50;

export function useDetectionStream(cameraId: string | undefined) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const detectionsRef = useRef<Detection[]>([]);
  const rafRef = useRef<number>(0);
  const { subscribe } = useWebSocket();

  const pruneExpired = useCallback(() => {
    const now = Date.now();
    const alive = detectionsRef.current.filter((d) => now - d.ts < d.ttlMs);
    if (alive.length !== detectionsRef.current.length) {
      detectionsRef.current = alive;
      setDetections(alive);
    }
    rafRef.current = requestAnimationFrame(pruneExpired);
  }, []);

  useEffect(() => {
    if (!cameraId) return;

    rafRef.current = requestAnimationFrame(pruneExpired);

    const unsub = subscribe(
      "live-view-events",
      (payload: Record<string, unknown>) => {
        const camId =
          (payload.camera_id as string) || (payload.cameraId as string);
        if (camId !== cameraId) return;

        const bbox = payload.bbox_json || payload.bbox;
        if (!bbox || typeof bbox !== "object") return;

        const det: Detection = {
          id: (payload.id as string) || `${Date.now()}-${Math.random()}`,
          bbox: bbox as Detection["bbox"],
          label:
            (payload.type as string) || (payload.label as string) || "unknown",
          confidence: (payload.confidence as number) || 0,
          ts: Date.now(),
          ttlMs: DEFAULT_TTL,
        };

        const current = detectionsRef.current;
        const next =
          current.length >= MAX_DETECTIONS
            ? [...current.slice(-MAX_DETECTIONS + 1), det]
            : [...current, det];
        detectionsRef.current = next;
        setDetections(next);
      },
    );

    return () => {
      unsub();
      cancelAnimationFrame(rafRef.current);
      detectionsRef.current = [];
      setDetections([]);
    };
  }, [cameraId, subscribe, pruneExpired]);

  return { detections };
}
