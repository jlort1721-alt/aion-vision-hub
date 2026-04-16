import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

interface EventDensityBucket {
  ts: string;
  count: number;
  severity_max: string;
}

interface EventTimelineSparklineProps {
  cameraId: string;
  windowMin?: number;
  onTimestampClick?: (ts: string) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#9ca3af",
};

function SparklineInner({
  cameraId,
  windowMin = 60,
  onTimestampClick,
}: EventTimelineSparklineProps) {
  const { data: buckets } = useQuery({
    queryKey: ["events-density", cameraId, windowMin],
    queryFn: async () => {
      const res = await apiClient.get(
        `/events/density?camera_id=${cameraId}&window_min=${windowMin}&bucket_sec=60`,
      );
      return (res as { buckets: EventDensityBucket[] }).buckets ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !!cameraId,
  });

  const maxCount = useMemo(
    () => Math.max(1, ...(buckets ?? []).map((b) => b.count)),
    [buckets],
  );

  if (!buckets || buckets.length === 0) return null;

  const barWidth = 100 / buckets.length;

  return (
    <svg
      viewBox={`0 0 ${buckets.length} 24`}
      className="w-full h-6 opacity-80"
      preserveAspectRatio="none"
    >
      {buckets.map((b, i) => {
        const h = (b.count / maxCount) * 22;
        const color = SEVERITY_COLORS[b.severity_max] ?? SEVERITY_COLORS.info;
        return (
          <rect
            key={b.ts}
            x={i}
            y={24 - h}
            width={0.8}
            height={h}
            fill={color}
            rx={0.1}
            style={{ cursor: onTimestampClick ? "pointer" : "default" }}
            onClick={() => onTimestampClick?.(b.ts)}
          >
            <title>
              {new Date(b.ts).toLocaleTimeString()} — {b.count} evento
              {b.count !== 1 ? "s" : ""} ({b.severity_max})
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

export const EventTimelineSparkline = memo(SparklineInner);
