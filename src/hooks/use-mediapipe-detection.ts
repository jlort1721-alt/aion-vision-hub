import { useEffect, useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────
export interface Detection {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface UseMediaPipeDetectionProps {
  videoElement: HTMLVideoElement | null;
  enabled: boolean;
  confidenceThreshold?: number;
}

interface UseMediaPipeDetectionResult {
  detections: Detection[];
  isModelLoaded: boolean;
  fps: number;
}

// ── Constants ─────────────────────────────────────────────────
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const TARGET_FPS = 4;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

// ── Hook ──────────────────────────────────────────────────────
export function useMediaPipeDetection({
  videoElement,
  enabled,
  confidenceThreshold = 0.5,
}: UseMediaPipeDetectionProps): UseMediaPipeDetectionResult {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [fps, setFps] = useState(0);

  const detectorRef = useRef<unknown>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load model lazily when enabled
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function loadModel() {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const { ObjectDetector, FilesetResolver } = vision;

        const wasmFileset = await FilesetResolver.forVisionTasks(WASM_URL);

        const detector = await ObjectDetector.createFromOptions(wasmFileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          scoreThreshold: confidenceThreshold,
        });

        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector;
        setIsModelLoaded(true);
      } catch (error) {
        // Model may fail to load on some browsers (no WebGL, no WASM, etc.)
        if (!cancelled) {
          console.error('[MediaPipe] Failed to load object detector:', error);
          setIsModelLoaded(false);
        }
      }
    }

    loadModel();

    return () => {
      cancelled = true;
    };
  }, [enabled, confidenceThreshold]);

  // Clean up model when disabled or unmounted
  useEffect(() => {
    if (enabled) return;

    const detector = detectorRef.current as { close?: () => void } | null;
    if (detector?.close) {
      detector.close();
      detectorRef.current = null;
      setIsModelLoaded(false);
      setDetections([]);
    }
  }, [enabled]);

  // FPS counter
  useEffect(() => {
    if (!enabled || !isModelLoaded) return;

    frameCountRef.current = 0;

    fpsIntervalRef.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
        fpsIntervalRef.current = null;
      }
      setFps(0);
    };
  }, [enabled, isModelLoaded]);

  // Detection loop callback
  const runDetection = useCallback(
    (timestamp: number) => {
      const detector = detectorRef.current as {
        detectForVideo?: (
          video: HTMLVideoElement,
          timestamp: number,
        ) => { detections: Array<{
          categories: Array<{ categoryName: string; score: number }>;
          boundingBox?: { originX: number; originY: number; width: number; height: number };
        }> };
      } | null;

      if (!detector?.detectForVideo || !videoElement || videoElement.readyState < 2) {
        rafIdRef.current = requestAnimationFrame(runDetection);
        return;
      }

      // Frame skipping for target FPS
      const elapsed = timestamp - lastFrameTimeRef.current;
      if (elapsed < FRAME_INTERVAL_MS) {
        rafIdRef.current = requestAnimationFrame(runDetection);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      try {
        const result = detector.detectForVideo(videoElement, performance.now());

        const mapped: Detection[] = result.detections
          .filter((d) => d.boundingBox && d.categories.length > 0)
          .map((d) => ({
            label: d.categories[0].categoryName,
            confidence: d.categories[0].score,
            boundingBox: {
              x: d.boundingBox!.originX,
              y: d.boundingBox!.originY,
              width: d.boundingBox!.width,
              height: d.boundingBox!.height,
            },
          }));

        setDetections(mapped);
        frameCountRef.current += 1;
      } catch {
        // Detection frame error — skip silently
      }

      rafIdRef.current = requestAnimationFrame(runDetection);
    },
    [videoElement],
  );

  // Start / stop detection loop
  useEffect(() => {
    if (!enabled || !isModelLoaded || !videoElement) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    rafIdRef.current = requestAnimationFrame(runDetection);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enabled, isModelLoaded, videoElement, runDetection]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
      const detector = detectorRef.current as { close?: () => void } | null;
      if (detector?.close) {
        detector.close();
      }
    };
  }, []);

  return { detections, isModelLoaded, fps };
}
