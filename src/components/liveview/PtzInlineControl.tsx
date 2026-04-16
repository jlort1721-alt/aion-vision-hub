import { memo, useState, useCallback } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Square,
} from "lucide-react";
import { apiClient } from "../../lib/api-client";

interface PtzInlineControlProps {
  sessionId: string;
  channel?: number;
}

const ACTIONS = [
  { key: "tilt_up", icon: ArrowUp, row: 0, col: 1 },
  { key: "pan_left", icon: ArrowLeft, row: 1, col: 0 },
  { key: "stop", icon: Square, row: 1, col: 1 },
  { key: "pan_right", icon: ArrowRight, row: 1, col: 2 },
  { key: "tilt_down", icon: ArrowDown, row: 2, col: 1 },
] as const;

function PtzInlineControlInner({
  sessionId,
  channel = 1,
}: PtzInlineControlProps) {
  const [speed, setSpeed] = useState(4);
  const [busy, setBusy] = useState(false);

  const sendPtz = useCallback(
    async (action: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await apiClient.post(`/reverse/sessions/${sessionId}/ptz`, {
          channel,
          action,
          speed,
        });
      } catch {
        /* silently fail — PTZ is best-effort */
      } finally {
        setBusy(false);
      }
    },
    [sessionId, channel, speed, busy],
  );

  return (
    <div className="flex flex-col items-center gap-2 p-2">
      <div className="grid grid-cols-3 gap-1 w-24 h-24">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const action = ACTIONS.find((a) => a.row === row && a.col === col);
            if (!action) {
              return <div key={`${row}-${col}`} />;
            }
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                className="flex items-center justify-center w-8 h-8 rounded bg-navy-800/80 hover:bg-navy-700 text-white transition-colors disabled:opacity-40"
                disabled={busy}
                onMouseDown={() => sendPtz(action.key)}
                onMouseUp={() => action.key !== "stop" && sendPtz("stop")}
                onMouseLeave={() => action.key !== "stop" && sendPtz("stop")}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          }),
        )}
      </div>

      <div className="flex gap-1">
        <button
          className="flex items-center justify-center w-8 h-8 rounded bg-navy-800/80 hover:bg-navy-700 text-white disabled:opacity-40"
          disabled={busy}
          onMouseDown={() => sendPtz("zoom_out")}
          onMouseUp={() => sendPtz("stop")}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <input
          type="range"
          min={1}
          max={8}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-16 accent-brand-red-600"
          title={`Velocidad: ${speed}`}
        />
        <button
          className="flex items-center justify-center w-8 h-8 rounded bg-navy-800/80 hover:bg-navy-700 text-white disabled:opacity-40"
          disabled={busy}
          onMouseDown={() => sendPtz("zoom_in")}
          onMouseUp={() => sendPtz("stop")}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export const PtzInlineControl = memo(PtzInlineControlInner);
