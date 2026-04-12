import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Server,
  Wifi,
  WifiOff,
  Shield,
  ShieldCheck,
  ShieldX,
  Clock,
  Activity,
  Radio,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
} from "lucide-react";

interface ReverseDevice {
  id: string;
  vendor: string;
  device_id: string;
  display_name: string;
  status: string;
  channel_count: number;
  last_seen_at: string;
  metadata: Record<string, unknown>;
}

interface ReverseSession {
  id: string;
  vendor: string;
  device_id: string;
  display_name: string;
  state: string;
  remote_addr: string;
  last_heartbeat: string;
  opened_at: string;
}

interface ReverseEvent {
  id: number;
  kind: string;
  display_name: string;
  vendor: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface ReverseHealth {
  status: string;
  devices: { total: number; online: number };
  sessions: { total: number; online: number };
  activeStreams: number;
  timestamp: string;
}

const statusColors: Record<string, string> = {
  online: "bg-green-500",
  approved: "bg-blue-500",
  pending_approval: "bg-yellow-500",
  blocked: "bg-red-500",
  offline: "bg-zinc-500",
};

const statusLabels: Record<string, string> = {
  online: "En línea",
  approved: "Aprobado",
  pending_approval: "Pendiente",
  blocked: "Bloqueado",
  offline: "Desconectado",
};

const vendorColors: Record<string, string> = {
  hikvision: "bg-blue-600",
  dahua: "bg-green-600",
};

function timeAgo(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export default function ReverseFleetPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"devices" | "events">("devices");

  const { data: health } = useQuery<ReverseHealth>({
    queryKey: ["reverse-health"],
    queryFn: () => apiClient.get("/reverse/health") as Promise<ReverseHealth>,
    refetchInterval: 30_000,
  });

  const { data: devices = [], isLoading: loadingDevices } = useQuery<
    ReverseDevice[]
  >({
    queryKey: ["reverse-devices"],
    queryFn: async () => {
      const res = (await apiClient.get("/reverse/devices")) as Record<
        string,
        unknown
      >;
      return (res?.data ?? res ?? []) as ReverseDevice[];
    },
    refetchInterval: 15_000,
  });

  const { data: sessions = [] } = useQuery<ReverseSession[]>({
    queryKey: ["reverse-sessions"],
    queryFn: async () => {
      const res = (await apiClient.get("/reverse/sessions")) as Record<
        string,
        unknown
      >;
      return (res?.data ?? res ?? []) as ReverseSession[];
    },
    refetchInterval: 15_000,
  });

  const { data: events = [] } = useQuery<ReverseEvent[]>({
    queryKey: ["reverse-events"],
    queryFn: async () => {
      const res = (await apiClient.get("/reverse/events")) as Record<
        string,
        unknown
      >;
      return (res?.data ?? res ?? []) as ReverseEvent[];
    },
    refetchInterval: 30_000,
  });

  const handleApprove = async (id: string) => {
    try {
      await apiClient.post(`/reverse/devices/${id}/approve`, {});
      queryClient.invalidateQueries({ queryKey: ["reverse-devices"] });
      toast.success("Dispositivo aprobado");
    } catch {
      toast.error("Error al aprobar");
    }
  };

  const handleBlock = async (id: string) => {
    try {
      await apiClient.post(`/reverse/devices/${id}/block`, {});
      queryClient.invalidateQueries({ queryKey: ["reverse-devices"] });
      toast.success("Dispositivo bloqueado");
    } catch {
      toast.error("Error al bloquear");
    }
  };

  const pendingCount = devices.filter(
    (d) => d.status === "pending_approval",
  ).length;
  const onlineCount = devices.filter((d) => d.status === "online").length;
  const onlineSessions = sessions.filter((s) => s.state === "online").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            Flota Reverse-Connect
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dispositivos conectados directamente al VPS por ISUP / Platform
            Access
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {health?.status === "ok" ? (
            <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500 mr-1" />
          )}
          Gateway {health?.status ?? "..."}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Dispositivos Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-500" />
              {onlineCount}/{devices.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Sesiones Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              {onlineSessions}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Pendientes Aprobación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              {pendingCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">
              Streams Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-500" />
              {health?.activeStreams ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2">
        <Button
          variant={tab === "devices" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("devices")}
        >
          <Server className="h-4 w-4 mr-1" />
          Dispositivos ({devices.length})
        </Button>
        <Button
          variant={tab === "events" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("events")}
        >
          <Activity className="h-4 w-4 mr-1" />
          Eventos ({events.length})
        </Button>
      </div>

      {/* Device Table */}
      {tab === "devices" && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="grid grid-cols-[1fr_80px_90px_60px_120px_100px_120px] gap-2 px-4 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                <span>Nombre</span>
                <span>Vendor</span>
                <span>Estado</span>
                <span>Ch</span>
                <span>IP</span>
                <span>Última vez</span>
                <span>Acciones</span>
              </div>
              {loadingDevices ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Sin dispositivos registrados
                </div>
              ) : (
                devices.map((d) => (
                  <div
                    key={d.id}
                    className="grid grid-cols-[1fr_80px_90px_60px_120px_100px_120px] gap-2 px-4 py-2.5 border-b hover:bg-muted/30 items-center text-sm"
                  >
                    <span className="font-medium truncate">
                      {d.display_name || d.device_id}
                    </span>
                    <Badge
                      className={`text-[10px] text-white ${vendorColors[d.vendor] ?? "bg-zinc-500"}`}
                    >
                      {d.vendor}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${statusColors[d.status] ?? "bg-zinc-400"}`}
                      />
                      <span className="text-xs">
                        {statusLabels[d.status] ?? d.status}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {d.channel_count}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {(d.metadata as Record<string, string>)?.ip ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(d.last_seen_at)}
                    </span>
                    <div className="flex gap-1">
                      {d.status === "pending_approval" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => handleApprove(d.id)}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Aprobar
                        </Button>
                      )}
                      {d.status !== "blocked" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] gap-1 text-destructive"
                          onClick={() => handleBlock(d.id)}
                        >
                          <ShieldX className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Events */}
      {tab === "events" && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              {events.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Sin eventos recientes
                </div>
              ) : (
                events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b hover:bg-muted/30"
                  >
                    <Badge variant="outline" className="text-[10px]">
                      {e.kind}
                    </Badge>
                    <span className="text-sm flex-1 truncate">
                      {e.display_name}
                    </span>
                    <Badge
                      className={`text-[10px] text-white ${vendorColors[e.vendor] ?? "bg-zinc-500"}`}
                    >
                      {e.vendor}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(e.created_at)}
                    </span>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
