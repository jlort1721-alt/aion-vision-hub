import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, XCircle, Zap } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { RouteBadge } from "./RouteBadge";
import { LiveVideo } from "./LiveVideo";

type RouteKind =
  | "rtsp_direct"
  | "p2p_dahua"
  | "gb28181"
  | "isup_native"
  | "imou_cloud";

interface Route {
  id: string;
  kind: RouteKind;
  priority: number;
  state: "healthy" | "degraded" | "failed" | "unknown" | "disabled";
  fail_count: number;
  last_check_at: string | null;
  last_ok_at: string | null;
}

interface Device {
  id: string;
  device_id: string;
  vendor: "dahua" | "hikvision";
  display_name: string | null;
  metadata: Record<string, unknown>;
  routes: Route[];
  online_sessions: number;
}

export function DeviceDetail({ device }: { device: Device }) {
  const qc = useQueryClient();
  const [activeChannel] = useState(1);

  const promote = useMutation({
    mutationFn: (kind: string) =>
      apiClient.post(
        `/vision-hub/devices/${device.id}/route/${kind}/promote`,
        {},
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vh", "devices"] }),
  });
  const disable = useMutation({
    mutationFn: (kind: string) =>
      apiClient.post(`/vision-hub/devices/${device.id}/route/${kind}/disable`, {
        reason: "manual",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vh", "devices"] }),
  });
  const probe = useMutation({
    mutationFn: () =>
      apiClient.post(`/vision-hub/devices/${device.id}/probe`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vh", "devices"] }),
  });

  const sorted = [...device.routes].sort((a, b) => a.priority - b.priority);
  const active = sorted.find(
    (r) => r.state === "healthy" || r.state === "degraded",
  );

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-3">
            <span>{device.display_name ?? device.device_id}</span>
            <Badge
              variant="outline"
              className="uppercase text-xs border-slate-700"
            >
              {device.vendor}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LiveVideo deviceId={device.device_id} channel={activeChannel} />
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase text-slate-400 flex items-center justify-between">
            Rutas disponibles
            <Button
              size="sm"
              variant="outline"
              onClick={() => probe.mutate()}
              disabled={probe.isPending}
            >
              <Zap className="w-3 h-3 mr-1" /> Probar ahora
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between p-2 rounded border ${
                r.id === active?.id
                  ? "border-[#D4A017] bg-slate-800"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <RouteBadge route={r} />
                <span className="text-xs text-slate-400">
                  prioridad {r.priority}
                </span>
                {r.fail_count > 0 && (
                  <span className="text-xs text-red-400">
                    {r.fail_count} fallos
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => promote.mutate(r.kind)}
                  disabled={r.state === "disabled" || r.priority === 1}
                  title="Subir prioridad"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => disable.mutate(r.kind)}
                  disabled={r.state === "disabled"}
                  title="Deshabilitar"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase text-slate-400">
            Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-[10px] text-slate-500 font-mono overflow-x-auto">
            {JSON.stringify(device.metadata, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
