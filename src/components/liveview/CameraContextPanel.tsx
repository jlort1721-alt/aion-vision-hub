import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useCameraLinks } from "../../services/camera-links-api";
import { apiClient } from "../../lib/api-client";
import { DoorOpen, Phone, Lightbulb, Bell, Users, Camera } from "lucide-react";

interface CameraContextPanelProps {
  cameraId: string | null;
  cameraName?: string;
}

function CameraContextPanelInner({
  cameraId,
  cameraName,
}: CameraContextPanelProps) {
  const { data: links } = useCameraLinks(cameraId);

  const grouped = useMemo(() => {
    if (!links) return { intercom: [], door: [], iot_relay: [], sensor: [] };
    return {
      intercom: links.filter((l) => l.linkType === "intercom"),
      door: links.filter((l) => l.linkType === "door"),
      iot_relay: links.filter((l) => l.linkType === "iot_relay"),
      sensor: links.filter((l) => l.linkType === "sensor"),
    };
  }, [links]);

  const { data: recentEvents } = useQuery({
    queryKey: ["camera-events-recent", cameraId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/events?deviceId=${cameraId}&limit=10&sort=desc`,
      );
      return (res as { data: Array<Record<string, unknown>> }).data ?? [];
    },
    enabled: !!cameraId,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const { data: recentAccess } = useQuery({
    queryKey: ["camera-access-recent", cameraId],
    queryFn: async () => {
      const res = await apiClient.get(`/access-control/logs?limit=10`);
      return (res as { data: Array<Record<string, unknown>> }).data ?? [];
    },
    enabled: !!cameraId && grouped.door.length > 0,
    staleTime: 30_000,
  });

  if (!cameraId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Camera className="w-10 h-10 mb-2 opacity-40" />
        <p className="text-sm text-center">
          Selecciona una cámara para ver controles y contexto
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b bg-navy-900/40">
        <h3 className="text-sm font-semibold text-white truncate">
          {cameraName || "Cámara"}
        </h3>
      </div>

      <Tabs
        defaultValue="doors"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid grid-cols-5 mx-2 mt-2">
          <TabsTrigger value="doors" title="Puertas">
            <DoorOpen className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="intercom" title="Citofonía">
            <Phone className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="iot" title="IoT">
            <Lightbulb className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="events" title="Eventos">
            <Bell className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="access" title="Accesos">
            <Users className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          <TabsContent value="doors" className="mt-0 space-y-2">
            {grouped.door.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin puertas vinculadas
              </p>
            ) : (
              grouped.door.map((link) => <DoorCard key={link.id} link={link} />)
            )}
          </TabsContent>

          <TabsContent value="intercom" className="mt-0 space-y-2">
            {grouped.intercom.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin citófonos vinculados
              </p>
            ) : (
              grouped.intercom.map((link) => (
                <IntercomCard key={link.id} link={link} />
              ))
            )}
          </TabsContent>

          <TabsContent value="iot" className="mt-0 space-y-2">
            {[...grouped.iot_relay, ...grouped.sensor].length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin dispositivos IoT vinculados
              </p>
            ) : (
              [...grouped.iot_relay, ...grouped.sensor].map((link) => (
                <IotCard key={link.id} link={link} />
              ))
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-0 space-y-1">
            {!recentEvents || recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin eventos recientes
              </p>
            ) : (
              recentEvents.map((ev) => (
                <div
                  key={ev.id as string}
                  className="flex items-center gap-2 p-2 rounded bg-navy-800/40 text-xs"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${severityColor(ev.severity as string)}`}
                  />
                  <span className="flex-1 truncate">{ev.title as string}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {timeAgo(ev.created_at as string)}
                  </span>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="access" className="mt-0 space-y-1">
            {!recentAccess || recentAccess.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin accesos recientes
              </p>
            ) : (
              recentAccess.map((log) => (
                <div
                  key={log.id as string}
                  className="flex items-center gap-2 p-2 rounded bg-navy-800/40 text-xs"
                >
                  <span>{log.direction === "in" ? "→" : "←"}</span>
                  <span className="flex-1 truncate">
                    {(log.person_name as string) || "Desconocido"}
                  </span>
                  <span className="text-muted-foreground">
                    {log.method as string}
                  </span>
                </div>
              ))
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

interface LinkInfo {
  id: string;
  linkType: string;
  deviceName: string | null;
  deviceStatus: string | null;
  linkedDeviceId: string;
}

function DoorCard({ link }: { link: LinkInfo }) {
  const handleOpen = async () => {
    try {
      await apiClient.post("/intercom/door/open", {
        deviceId: link.linkedDeviceId,
        reason: "Live View control panel",
      });
    } catch {
      /* toast handled by apiClient */
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-navy-800/60">
      <DoorOpen className="w-4 h-4 text-brand-red-600" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">
          {link.deviceName || "Puerta"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {link.deviceStatus === "online" ? "En línea" : "Offline"}
        </p>
      </div>
      <button
        className="px-2 py-1 text-[10px] font-bold rounded bg-brand-red-600 hover:bg-brand-red-700 text-white disabled:opacity-40"
        disabled={link.deviceStatus !== "online"}
        onClick={handleOpen}
      >
        Abrir
      </button>
    </div>
  );
}

function IntercomCard({ link }: { link: LinkInfo }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-navy-800/60">
      <Phone className="w-4 h-4 text-green-500" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">
          {link.deviceName || "Citófono"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {link.deviceStatus === "online" ? "Disponible" : "Offline"}
        </p>
      </div>
      <button
        className="px-2 py-1 text-[10px] font-bold rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-40"
        disabled={link.deviceStatus !== "online"}
      >
        Llamar
      </button>
    </div>
  );
}

function IotCard({ link }: { link: LinkInfo }) {
  const handleToggle = async () => {
    try {
      await apiClient.post(`/domotics/${link.linkedDeviceId}/action`, {
        action: "toggle",
      });
    } catch {
      /* toast handled by apiClient */
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-navy-800/60">
      <Lightbulb className="w-4 h-4 text-yellow-400" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">
          {link.deviceName || "Dispositivo"}
        </p>
        <p className="text-[10px] text-muted-foreground">{link.linkType}</p>
      </div>
      <button
        className="px-2 py-1 text-[10px] font-bold rounded bg-yellow-600 hover:bg-yellow-700 text-white"
        onClick={handleToggle}
      >
        Toggle
      </button>
    </div>
  );
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-yellow-500";
    case "low":
      return "bg-blue-500";
    default:
      return "bg-gray-400";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export const CameraContextPanel = memo(CameraContextPanelInner);
