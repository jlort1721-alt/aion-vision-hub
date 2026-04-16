import { useState, useEffect, useCallback } from "react";

type GridSize = 1 | 4 | 9 | 16 | 25 | 36 | 49 | 64;

const STORAGE_KEY = "aion-lv-grid";
const VALID_SIZES: GridSize[] = [1, 4, 9, 16, 25, 36, 49, 64];

function loadSaved(): GridSize | null {
  try {
    const v = parseInt(localStorage.getItem(STORAGE_KEY) ?? "", 10);
    return VALID_SIZES.includes(v as GridSize) ? (v as GridSize) : null;
  } catch {
    return null;
  }
}

function detectDefault(): GridSize {
  if (typeof window === "undefined") return 9;
  const w = window.innerWidth;
  if (w < 768) return 4;
  if (w < 1280) return 9;
  return 16;
}

export function useLiveViewLayout() {
  const [gridSize, setGridSizeRaw] = useState<GridSize>(
    () => loadSaved() ?? detectDefault(),
  );
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(gridSize));
  }, [gridSize]);

  const setGridSize = useCallback((size: GridSize) => {
    setGridSizeRaw(size);
    setCurrentPage(0);
  }, []);

  const cols = Math.max(1, Math.round(Math.sqrt(gridSize)));

  return {
    gridSize,
    setGridSize,
    currentPage,
    setCurrentPage,
    cols,
    gridOptions: VALID_SIZES,
  };
}
