import { useCallback, useMemo } from "react";

interface VirtualGridConfig {
  gridSize: number;
  containerWidth: number;
  containerHeight: number;
  gap?: number;
}

interface VirtualGridResult {
  columnCount: number;
  rowCount: number;
  columnWidth: number;
  rowHeight: number;
  totalItems: number;
  getItemIndex: (row: number, col: number) => number;
  isValidIndex: (index: number, totalCameras: number) => boolean;
}

export function useVirtualCameraGrid({
  gridSize,
  containerWidth,
  containerHeight,
  gap = 4,
}: VirtualGridConfig): VirtualGridResult {
  const columnCount = useMemo(
    () => Math.max(1, Math.round(Math.sqrt(gridSize))),
    [gridSize],
  );

  const rowCount = useMemo(
    () => Math.ceil(gridSize / columnCount),
    [gridSize, columnCount],
  );

  const columnWidth = useMemo(() => {
    if (containerWidth <= 0) return 200;
    return Math.floor((containerWidth - gap * (columnCount - 1)) / columnCount);
  }, [containerWidth, columnCount, gap]);

  const rowHeight = useMemo(() => {
    if (containerHeight <= 0) return 150;
    return Math.floor((containerHeight - gap * (rowCount - 1)) / rowCount);
  }, [containerHeight, rowCount, gap]);

  const getItemIndex = useCallback(
    (row: number, col: number) => row * columnCount + col,
    [columnCount],
  );

  const isValidIndex = useCallback(
    (index: number, totalCameras: number) => index >= 0 && index < totalCameras,
    [],
  );

  return {
    columnCount,
    rowCount,
    columnWidth,
    rowHeight,
    totalItems: gridSize,
    getItemIndex,
    isValidIndex,
  };
}
