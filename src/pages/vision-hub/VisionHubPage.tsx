import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Radar,
  Activity,
  Radio,
  Globe,
  AlertTriangle,
  Search,
  ChevronRight,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { RouteBadge } from "./components/RouteBadge";
import { DeviceDetail } from "./components/DeviceDetail";
import { FailoverHistory } from "./components/FailoverHistory";
import { useVisionHubEvents } from "./hooks/useVisionHubEvents";

type RouteKind =
  | "rtsp_direct"
  | "p2p_dahua"
  | "gb28181"
  | "isup_native"
  | "imou_cloud";
type RouteState = "healthy" | "degraded" | "failed" | "unknown" | "disabled";

interface Route {
  id: string;
  kind: RouteKind;
  priority: number;
  state: RouteState;
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

export default function VisionHubPage() {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Device | null>(null);
  const [tab, setTab] = useState<"overview" | "history">("overview");

  const { data: devicesData } = useQuery({
    queryKey: ["vh", "devices"],
    queryFn: () =>
      apiClient.get<{ items: Device[]; total: number }>("/vision-hub/devices", {
        limit: "200",
      }),
    refetchInterval: 10_000,
  });

  const liveEvents = useVisionHubEvents();
  const devices = devicesData?.items ?? [];

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return devices;
    return devices.filter(
      (d) =>
        d.device_id.toLowerCase().includes(f) ||
        d.vendor.includes(f) ||
        (d.display_name ?? "").toLowerCase().includes(f),
    );
  }, [devices, filter]);

  const kpi = useMemo(() => {
    const out = { online: 0, degraded: 0, failed: 0, imou: 0 };
    for (const d of devices) {
      const active = d.routes.find(
        (r) => r.state === "healthy" || r.state === "degraded",
      );
      if (!active) {
        out.failed++;
        continue;
      }
      if (active.state === "degraded") out.degraded++;
      else out.online++;
      if (active.kind === "imou_cloud") out.imou++;
    }
    return out;
  }, [devices]);

  return (
    <div className="min-h-screen bg-[#030810] text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar className="w-8 h-8 text-[#D4A017]" />
          <div>
            <h1
              className="text-3xl font-black tracking-tight uppercase"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Vision Hub
            </h1>
            <p className="text-xs text-slate-400">
              Multi-route video · GB28181 + dh-p2p + RTSP + IMOU fallback
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <KPI
            icon={<Activity className="w-4 h-4" />}
            value={kpi.online}
            label="Healthy"
            tone="green"
          />
          <KPI
            icon={<Activity className="w-4 h-4" />}
            value={kpi.degraded}
            label="Degraded"
            tone="gold"
          />
          <KPI
            icon={<AlertTriangle className="w-4 h-4" />}
            value={kpi.failed}
            label="Failed"
            tone="red"
          />
          <KPI
            icon={<Globe className="w-4 h-4" />}
            value={kpi.imou}
            label="IMOU"
            tone="gray"
          />
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "overview" | "history")}
        className="p-6"
      >
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="overview">
            Overview ({devices.length})
          </TabsTrigger>
          <TabsTrigger value="history">Failover history</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-4 h-4 text-slate-500" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por device ID, nombre o vendor..."
              className="max-w-md bg-slate-900 border-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6">
            <DeviceList
              devices={filtered}
              selected={selected}
              onSelect={setSelected}
            />
            <div>
              {selected ? (
                <DeviceDetail device={selected} />
              ) : (
                <Card className="bg-slate-900 border-slate-800 h-full">
                  <CardContent className="p-12 text-center text-slate-500">
                    Selecciona un sitio para ver video en vivo, rutas
                    disponibles y controles.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <FailoverHistory />
        </TabsContent>
      </Tabs>

      {liveEvents.length > 0 && (
        <div className="fixed bottom-4 right-4 space-y-2 w-80 pointer-events-none">
          {liveEvents.slice(0, 3).map((e, i) => (
            <Card key={i} className="bg-slate-900 border-[#D4A017]/40">
              <CardContent className="p-3 text-xs">
                <div className="font-bold text-[#D4A017] flex items-center gap-1">
                  <Radio className="w-3 h-3" /> Failover · {e.device_id}
                </div>
                <div className="text-slate-400 mt-1">
                  {e.prev ?? "?"} →{" "}
                  <span className="text-white font-bold">{e.next}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function KPI({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "green" | "gold" | "red" | "gray";
}) {
  const color =
    tone === "green"
      ? "#4ade80"
      : tone === "gold"
        ? "#D4A017"
        : tone === "red"
          ? "#C8232A"
          : "#64748b";
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded border border-slate-800 bg-slate-900">
      <span style={{ color }}>{icon}</span>
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-xl font-black" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function DeviceList({
  devices,
  selected,
  onSelect,
}: {
  devices: Device[];
  selected: Device | null;
  onSelect: (d: Device) => void;
}) {
  return (
    <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-2">
      {devices.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 text-slate-400 text-sm">
            Sin resultados. Si esperabas ver algo, revisa que el orchestrator
            este sano.
          </CardContent>
        </Card>
      )}
      {devices.map((d) => {
        const active = d.routes.find(
          (r) => r.state === "healthy" || r.state === "degraded",
        );
        const isSelected = selected?.id === d.id;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d)}
            className={`w-full text-left transition-all ${isSelected ? "scale-[1.01]" : ""}`}
          >
            <Card
              className={
                isSelected
                  ? "bg-slate-800 border-[#D4A017]"
                  : "bg-slate-900 border-slate-800 hover:border-slate-700"
              }
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-sm truncate">
                    {d.display_name ?? d.device_id}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase border-slate-700"
                    >
                      {d.vendor}
                    </Badge>
                    {active ? (
                      <RouteBadge route={active} />
                    ) : (
                      <span className="text-red-400 text-xs">sin ruta</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
