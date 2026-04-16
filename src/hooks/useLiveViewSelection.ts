import { useState, useCallback, useMemo } from "react";

type CameraDisplayMode = "video" | "snapshot" | "auto";

export function useLiveViewSelection() {
  const [focusedCamera, setFocusedCamera] = useState<string | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [cameraModes, setCameraModes] = useState<
    Map<string, CameraDisplayMode>
  >(new Map());

  const setCameraMode = useCallback(
    (cameraId: string, mode: CameraDisplayMode) => {
      setCameraModes((prev) => {
        const next = new Map(prev);
        next.set(cameraId, mode);
        return next;
      });
    },
    [],
  );

  const clearFocus = useCallback(() => {
    setFocusedCamera(null);
  }, []);

  const selectCamera = useCallback((cameraId: string | null) => {
    setSelectedCamera(cameraId);
  }, []);

  const focusCamera = useCallback((cameraId: string) => {
    setFocusedCamera(cameraId);
    setSelectedCamera(cameraId);
  }, []);

  return {
    focusedCamera,
    selectedCamera,
    cameraModes,
    setFocusedCamera: focusCamera,
    clearFocus,
    selectCamera,
    setCameraMode,
  };
}
