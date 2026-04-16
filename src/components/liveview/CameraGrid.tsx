import { memo, useCallback } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeGrid } from "react-window";
import { SmartCameraCell } from "../video/SmartCameraCell";
import { FF } from "../../lib/feature-flags";
import { useVirtualCameraGrid } from "../../hooks/useVirtualCameraGrid";

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

interface CellData {
  cameras: (SmartCamera | null)[];
  columnCount: number;
  cameraModes: Map<string, CameraDisplayMode>;
  onCellClick: (cameraId: string) => void;
  onModeChange: (cameraId: string, mode: CameraDisplayMode) => void;
}

const VirtualCell = memo(function VirtualCell({
  columnIndex,
  rowIndex,
  style,
  data,
}: {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: CellData;
}) {
  const index = rowIndex * data.columnCount + columnIndex;
  const camera = data.cameras[index] ?? null;

  return (
    <div style={{ ...style, padding: 2 }}>
      <SmartCameraCell
        camera={camera}
        variant="liveview"
        displayMode={
          camera ? (data.cameraModes.get(camera.id) ?? "auto") : "auto"
        }
        onModeChange={data.onModeChange}
        onClick={camera ? () => data.onCellClick(camera.id) : undefined}
      />
    </div>
  );
});

function VirtualGridInner({
  width,
  height,
  gridSize,
  cameras,
  cameraModes,
  onCellClick,
  onModeChange,
}: {
  width: number;
  height: number;
  gridSize: number;
  cameras: (SmartCamera | null)[];
  cameraModes: Map<string, CameraDisplayMode>;
  onCellClick: (cameraId: string) => void;
  onModeChange: (cameraId: string, mode: CameraDisplayMode) => void;
}) {
  const grid = useVirtualCameraGrid({
    gridSize,
    containerWidth: width,
    containerHeight: height,
  });

  const itemData: CellData = {
    cameras,
    columnCount: grid.columnCount,
    cameraModes,
    onCellClick,
    onModeChange,
  };

  return (
    <FixedSizeGrid
      columnCount={grid.columnCount}
      rowCount={grid.rowCount}
      columnWidth={grid.columnWidth}
      rowHeight={grid.rowHeight}
      width={width}
      height={height}
      itemData={itemData}
      overscanRowCount={1}
    >
      {VirtualCell}
    </FixedSizeGrid>
  );
}

function CameraGridInner({
  cameras,
  gridSize,
  focusedCameraId,
  cameraModes,
  onCellClick,
  onModeChange,
}: CameraGridProps) {
  const renderClassicGrid = useCallback(() => {
    const cols = Math.max(1, Math.round(Math.sqrt(gridSize)));
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
            displayMode={
              camera ? (cameraModes.get(camera.id) ?? "auto") : "auto"
            }
            onModeChange={onModeChange}
            onClick={camera ? () => onCellClick(camera.id) : undefined}
          />
        ))}
      </div>
    );
  }, [cameras, gridSize, cameraModes, onCellClick, onModeChange]);

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

  if (!FF.LIVE_VIEW_VIRTUALIZATION || gridSize <= 16) {
    return renderClassicGrid();
  }

  return (
    <AutoSizer>
      {({ width, height }: { width: number; height: number }) => (
        <VirtualGridInner
          width={width}
          height={height}
          gridSize={gridSize}
          cameras={cameras}
          cameraModes={cameraModes}
          onCellClick={onCellClick}
          onModeChange={onModeChange}
        />
      )}
    </AutoSizer>
  );
}

export const CameraGrid = memo(CameraGridInner);
