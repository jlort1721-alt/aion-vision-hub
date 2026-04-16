import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useWebSocket } from "@/hooks/use-websocket";
import { useLiveViewEvents } from "@/hooks/use-live-view-events";
import { Camera, AlertTriangle } from "lucide-react";

interface FloorPlanViewProps {
  siteId: string;
  onCameraSelect: (cameraId: string) => void;
}

interface FloorPlan {
  id: string;
  image_url: string;
  width: number;
  height: number;
}

interface DevicePosition {
  id: string;
  device_id: string;
  x: number;
  y: number;
  device_name?: string;
  device_status?: string;
}

function FloorPlanViewInner({ siteId, onCameraSelect }: FloorPlanViewProps) {
  const { data: floorPlan } = useQuery({
    queryKey: ["floor-plan", siteId],
    queryFn: async () => {
      const res = await apiClient.get(`/floor-plans/${siteId}`);
      return (res as { data: FloorPlan }).data ?? null;
    },
    enabled: !!siteId,
    staleTime: 120_000,
  });

  const { data: positions } = useQuery({
    queryKey: ["floor-plan-positions", siteId],
    queryFn: async () => {
      const res = await apiClient.get(`/floor-plans/${siteId}/positions`);
      return (res as { data: DevicePosition[] }).data ?? [];
    },
    enabled: !!siteId,
    staleTime: 60_000,
  });

  const { events: recentEvents } = useLiveViewEvents();

  const recentByCam = useMemo(() => {
    const map = new Map<string, { severity: string; ts: number }>();
    for (const ev of recentEvents) {
      const existing = map.get(ev.cameraId);
      const ts = new Date(ev.timestamp).getTime();
      if (!existing || ts > existing.ts) {
        map.set(ev.cameraId, { severity: ev.severity, ts });
      }
    }
    return map;
  }, [recentEvents]);

  if (!floorPlan) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Camera className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs text-center">
          Sin plano configurado para este sitio
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-navy-900/20 rounded">
      <img
        src={floorPlan.image_url}
        alt="Plano"
        className="w-full h-full object-contain"
        draggable={false}
      />

      {(positions ?? []).map((pos) => {
        const recent = recentByCam.get(pos.device_id);
        const now = Date.now();
        const ageMs = recent ? now - recent.ts : Infinity;
        const isOnline = pos.device_status === "online";

        let dotColor = "bg-gray-500";
        let pulse = false;
        if (!isOnline) {
          dotColor = "bg-gray-500";
        } else if (recent && ageMs < 60_000 && recent.severity === "critical") {
          dotColor = "bg-red-500";
          pulse = true;
        } else if (
          recent &&
          ageMs < 300_000 &&
          (recent.severity === "high" || recent.severity === "medium")
        ) {
          dotColor = "bg-yellow-500";
        } else if (isOnline) {
          dotColor = "bg-green-500";
        }

        return (
          <button
            key={pos.id}
            className="absolute flex items-center justify-center group"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={() => onCameraSelect(pos.device_id)}
            title={pos.device_name ?? pos.device_id}
          >
            <span
              className={`w-3 h-3 rounded-full ${dotColor} ${pulse ? "animate-pulse" : ""} ring-2 ring-navy-900/60`}
            />
            {recent && ageMs < 60_000 && (
              <AlertTriangle className="w-3 h-3 text-red-400 absolute -top-3 -right-3" />
            )}
            <span className="absolute -bottom-4 text-[9px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {pos.device_name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const FloorPlanView = memo(FloorPlanViewInner);
