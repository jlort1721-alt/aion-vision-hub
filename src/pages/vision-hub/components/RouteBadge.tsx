import { Badge } from "@/components/ui/badge";
import { Radio, Shield, Globe, Cable, Cloud } from "lucide-react";

type RouteKind =
  | "rtsp_direct"
  | "p2p_dahua"
  | "gb28181"
  | "isup_native"
  | "imou_cloud";
type RouteState = "healthy" | "degraded" | "failed" | "unknown" | "disabled";

export function RouteBadge({
  route,
}: {
  route: { kind: RouteKind; state: RouteState };
}) {
  const meta = KIND_META[route.kind];
  const stateMeta = STATE_META[route.state];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase flex items-center gap-1 ${stateMeta.cls}`}
      title={`${meta.label} · ${route.state}`}
    >
      <meta.Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
  );
}

const KIND_META: Record<
  RouteKind,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  rtsp_direct: { label: "RTSP", Icon: Cable },
  p2p_dahua: { label: "P2P", Icon: Radio },
  gb28181: { label: "GB", Icon: Shield },
  isup_native: { label: "ISUP", Icon: Globe },
  imou_cloud: { label: "IMOU", Icon: Cloud },
};

const STATE_META: Record<RouteState, { cls: string }> = {
  healthy: { cls: "border-green-500 text-green-400" },
  degraded: { cls: "border-yellow-500 text-yellow-400" },
  failed: { cls: "border-red-500 text-red-400" },
  unknown: { cls: "border-slate-600 text-slate-400" },
  disabled: { cls: "border-slate-700 text-slate-500 opacity-50" },
};
