import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Radar,
  Wifi,
  WifiOff,
  Shield,
  ShieldAlert,
  Search,
  RefreshCw,
  MonitorPlay,
  Ban,
} from "lucide-react";
import { SessionCard } from "@/components/reverse/SessionCard";
import { PTZJoystick } from "@/components/reverse/PTZJoystick";
import { DeviceApprovalDialog } from "@/components/reverse/DeviceApprovalDialog";

interface HealthData {
  status: string;
  devices: { total: number; online: number };
  sessions: { total: number; online: number };
  activeStreams: number;
}

interface Device {
  id: string;
  vendor: string;
  device_id: string;
  display_name: string;
  status: string;
  channel_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

interface Session {
  id: string;
  vendor: string;
  device_id: string;
  display_name: string;
  state: string;
  remote_addr: string;
  opened_at: string;
  last_heartbeat: string;
  channel_count: number;
}

export default function ReverseFleetPage() {
  const [search, setSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [approveDevice, setApproveDevice] = useState<Device | null>(null);
  const queryClient = useQueryClient();

  const { data: health } = useQuery<HealthData>({
    queryKey: ["reverse-health"],
    queryFn: () => apiClient.get("/reverse/health"),
    refetchInterval: 10_000,
  });

  const { data: devicesData, isLoading: devicesLoading } = useQuery<{
    items: Device[];
    total: number;
  }>({
    queryKey: ["reverse-devices"],
    queryFn: () => apiClient.get("/reverse/devices?limit=200"),
    refetchInterval: 15_000,
  });

  const { data: sessionsRaw, isLoading: sessionsLoading } = useQuery<Session[]>(
    {
      queryKey: ["reverse-sessions"],
      queryFn: () => apiClient.get("/reverse/sessions"),
      refetchInterval: 10_000,
    },
  );

  const devices = devicesData?.items ?? [];
  const sessions = sessionsRaw ?? [];

  const filteredDevices = devices.filter(
    (d) =>
      !search ||
      d.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.device_id.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredSessions = sessions.filter(
    (s) =>
      !search ||
      s.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.device_id.toLowerCase().includes(search.toLowerCase()),
  );

  const handleBlock = async (deviceId: string) => {
    try {
      await apiClient.post(`/reverse/devices/${deviceId}/block`, {});
      queryClient.invalidateQueries({ queryKey: ["reverse-devices"] });
    } catch (err) {
      console.error("Block error:", err);
    }
  };

  const stateColors: Record<string, string> = {
    online: "text-green-500",
    connecting: "text-yellow-500",
    degraded: "text-orange-500",
    disconnected: "text-red-500",
  };

  const statusColors: Record<string, string> = {
    online: "bg-green-500/10 text-green-500 border-green-500/20",
    approved: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    pending_approval: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    blocked: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar className="h-6 w-6 text-red-600" />
          <h1 className="text-2xl font-bold">Reverse Fleet</h1>
          <Badge variant="outline" className="text-xs">
            v1.1.0
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["reverse-health"] });
            queryClient.invalidateQueries({ queryKey: ["reverse-devices"] });
            queryClient.invalidateQueries({ queryKey: ["reverse-sessions"] });
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Dispositivos
              </span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {health?.devices.total ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-green-500">
              {health?.devices.online ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sesiones</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {health?.sessions.online ?? "-"}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                / {health?.sessions.total ?? "-"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <MonitorPlay className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Streams</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-yellow-600">
              {health?.activeStreams ?? "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="sessions" className="flex-1">
        <TabsList>
          <TabsTrigger value="sessions">
            Sesiones ({filteredSessions.length})
          </TabsTrigger>
          <TabsTrigger value="devices">
            Dispositivos ({filteredDevices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-2">
              {sessionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando sesiones...
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay sesiones activas
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    selected={selectedSession?.id === session.id}
                    onClick={() => setSelectedSession(session)}
                  />
                ))
              )}
            </div>
            <div>
              {selectedSession ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {selectedSession.display_name ||
                        selectedSession.device_id}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {selectedSession.vendor.toUpperCase()} &middot;{" "}
                      {selectedSession.remote_addr}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Estado</span>
                        <div
                          className={stateColors[selectedSession.state] ?? ""}
                        >
                          {selectedSession.state}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Canales</span>
                        <div>{selectedSession.channel_count ?? 1}</div>
                      </div>
                    </div>
                    <PTZJoystick sessionId={selectedSession.id} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    Selecciona una sesion para ver detalles y controles PTZ
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Dispositivo</th>
                  <th className="pb-2 font-medium">Fabricante</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium">Canales</th>
                  <th className="pb-2 font-medium">Ultimo contacto</th>
                  <th className="pb-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {devicesLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-muted-foreground"
                    >
                      Cargando...
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-muted-foreground"
                    >
                      No hay dispositivos
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((device) => (
                    <tr key={device.id}>
                      <td className="py-2">
                        <div className="font-medium">
                          {device.display_name || device.device_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {device.device_id}
                        </div>
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {device.vendor === "hikvision" ? "HIK" : "DAHUA"}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <Badge
                          variant="outline"
                          className={statusColors[device.status] ?? ""}
                        >
                          {device.status}
                        </Badge>
                      </td>
                      <td className="py-2">{device.channel_count ?? 1}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {device.last_seen_at
                          ? new Date(device.last_seen_at).toLocaleString(
                              "es-CO",
                            )
                          : "-"}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {device.status === "pending_approval" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setApproveDevice(device)}
                            >
                              <ShieldAlert className="h-3 w-3 mr-1" />
                              Aprobar
                            </Button>
                          )}
                          {device.status !== "blocked" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={() => handleBlock(device.id)}
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              Bloquear
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <DeviceApprovalDialog
        device={approveDevice}
        open={!!approveDevice}
        onOpenChange={(open) => !open && setApproveDevice(null)}
        onApproved={() =>
          queryClient.invalidateQueries({ queryKey: ["reverse-devices"] })
        }
      />
    </div>
  );
}
