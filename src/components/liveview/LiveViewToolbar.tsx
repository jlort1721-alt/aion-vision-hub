import { memo } from "react";
import {
  Grid2X2,
  Grid3X3,
  Maximize,
  ChevronLeft,
  ChevronRight,
  Circle,
} from "lucide-react";

type GridSize = 1 | 4 | 9 | 16 | 25 | 36 | 49 | 64;

interface LiveViewToolbarProps {
  gridSize: GridSize;
  gridOptions: GridSize[];
  currentPage: number;
  totalCameras: number;
  onGridSizeChange: (size: GridSize) => void;
  onPageChange: (page: number) => void;
  onRecordClick?: () => void;
  isRecording?: boolean;
}

const GRID_ICONS: Partial<Record<GridSize, React.ReactNode>> = {
  1: <Maximize className="w-3.5 h-3.5" />,
  4: <Grid2X2 className="w-3.5 h-3.5" />,
  9: <Grid3X3 className="w-3.5 h-3.5" />,
};

function LiveViewToolbarInner({
  gridSize,
  gridOptions,
  currentPage,
  totalCameras,
  onGridSizeChange,
  onPageChange,
  onRecordClick,
  isRecording,
}: LiveViewToolbarProps) {
  const totalPages = Math.max(1, Math.ceil(totalCameras / gridSize));

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-navy-900/60 border-b border-navy-700/50">
      <div className="flex items-center gap-1">
        {gridOptions.map((size) => {
          const cols = Math.round(Math.sqrt(size));
          const label = `${cols}x${cols}`;
          return (
            <button
              key={size}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                gridSize === size
                  ? "bg-brand-red-600 text-white"
                  : "bg-navy-800/60 text-muted-foreground hover:text-white hover:bg-navy-700"
              }`}
              onClick={() => onGridSizeChange(size)}
              title={label}
            >
              {GRID_ICONS[size] ?? label}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-navy-700 text-muted-foreground disabled:opacity-30"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-muted-foreground min-w-[3rem] text-center">
            {currentPage + 1}/{totalPages}
          </span>
          <button
            className="p-1 rounded hover:bg-navy-700 text-muted-foreground disabled:opacity-30"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {onRecordClick && (
        <button
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
            isRecording
              ? "bg-red-600 text-white animate-pulse"
              : "bg-navy-800/60 text-muted-foreground hover:text-white hover:bg-navy-700"
          }`}
          onClick={onRecordClick}
          title={isRecording ? "Grabando..." : "Grabar"}
        >
          <Circle className={`w-3 h-3 ${isRecording ? "fill-current" : ""}`} />
          {isRecording ? "REC" : "Grabar"}
        </button>
      )}
    </div>
  );
}

export const LiveViewToolbar = memo(LiveViewToolbarInner);
