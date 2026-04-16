import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Focus,
  Camera,
} from "lucide-react";

interface PTZJoystickProps {
  sessionId: string;
  channel?: number;
}

export function PTZJoystick({ sessionId, channel = 1 }: PTZJoystickProps) {
  const [speed, setSpeed] = useState(4);
  const [loading, setLoading] = useState(false);

  const sendPtz = async (action: string) => {
    setLoading(true);
    try {
      await apiClient.post(`/reverse/sessions/${sessionId}/ptz`, {
        channel,
        action,
        speed,
      });
    } catch (err) {
      console.error("PTZ error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSnapshot = async () => {
    try {
      const res = await apiClient.post<{ snapshotUrl: string }>(
        `/reverse/sessions/${sessionId}/snapshot`,
        {},
      );
      if (res?.snapshotUrl) {
        window.open(res.snapshotUrl, "_blank");
      }
    } catch (err) {
      console.error("Snapshot error:", err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Control PTZ
      </div>
      <div className="grid grid-cols-3 gap-1 w-fit mx-auto">
        <div />
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9"
          onClick={() => sendPtz("tilt_up")}
          disabled={loading}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <div />
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9"
          onClick={() => sendPtz("pan_left")}
          disabled={loading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9"
          onClick={() => sendPtz("stop")}
          disabled={loading}
        >
          <span className="h-3 w-3 rounded-full bg-red-500" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9"
          onClick={() => sendPtz("pan_right")}
          disabled={loading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div />
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9"
          onClick={() => sendPtz("tilt_down")}
          disabled={loading}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <div />
      </div>
      <div className="flex justify-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => sendPtz("zoom_in")}
          disabled={loading}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => sendPtz("zoom_out")}
          disabled={loading}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => sendPtz("focus_near")}
          disabled={loading}
        >
          <Focus className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={handleSnapshot}
          disabled={loading}
        >
          <Camera className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Velocidad:</span>
        <input
          type="range"
          min={1}
          max={8}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="flex-1 h-1.5"
        />
        <span className="w-4 text-center font-mono">{speed}</span>
      </div>
    </div>
  );
}
