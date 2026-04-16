import { memo, useCallback } from "react";
import { SmartCameraCell } from "@/components/video/SmartCameraCell";

interface SmartCamera {
  id: string;
  name: string;
  stream_key: string;
  status: string;
  site_name?: string;
}

type CameraDisplayMode = "video" | "snapshot" | "auto";

interface CameraGridProps {
  cameras: (SmartCamera | null)[];
  gridSize: number;
  focusedCameraId: string | null;
  cameraModes: Map<string, CameraDisplayMode>;
  onCellClick: (cameraId: string) => void;
  onModeChange: (cameraId: string, mode: CameraDisplayMode) => void;
}

function CameraGridInner({
  cameras,
  gridSize,
  focusedCameraId,
  cameraModes,
  onCellClick,
  onModeChange,
}: CameraGridProps) {
  const cols = Math.max(1, Math.round(Math.sqrt(gridSize)));

  if (focusedCameraId) {
    const focused = cameras.find((c) => c?.id === focusedCameraId) ?? null;
    return (
      <div className="h-full w-full">
        <SmartCameraCell
          camera={focused}
          variant="liveview"
          isFocused
          forceVideo
          displayMode="video"
          onModeChange={onModeChange}
          onClick={() => {}}
        />
      </div>
    );
  }

  return (
    <div
      className="grid gap-1 h-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${cols}, 1fr)`,
      }}
    >
      {cameras.map((camera, i) => (
        <SmartCameraCell
          key={camera?.id ?? `empty-${i}`}
          camera={camera}
          variant="liveview"
          displayMode={camera ? (cameraModes.get(camera.id) ?? "auto") : "auto"}
          onModeChange={onModeChange}
          onClick={camera ? () => onCellClick(camera.id) : undefined}
        />
      ))}
    </div>
  );
}

export const CameraGrid = memo(CameraGridInner);
