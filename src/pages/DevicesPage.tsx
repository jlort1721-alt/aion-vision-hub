import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDevices, useSites } from "@/hooks/use-api-data";
import type { ApiDevice, ApiSite } from "@/types/api-entities";
import { apiClient } from "@/lib/api-client";
import { useI18n } from "@/contexts/I18nContext";
import DeviceFormDialog from "@/components/devices/DeviceFormDialog";
import DeleteDeviceDialog from "@/components/devices/DeleteDeviceDialog";
import CloudAccountsPanel from "@/components/devices/CloudAccountsPanel";
import DataImportDialog from "@/components/shared/DataImportDialog";
import { lazy, Suspense } from "react";
const EWeLinkCloudPanel = lazy(
  () => import("@/components/devices/EWeLinkCloudPanel"),
);
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Upload,
  Wifi,
  WifiOff,
  AlertCircle,
  MoreHorizontal,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  Video,
  PlayCircle,
  Monitor,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageShell } from "@/components/shared/PageShell";
import ErrorState from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DevicesPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<any>(null);
  const [deleteDevice, setDeleteDevice] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);

  const {
    data: rawDevices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useDevices();
  const { data: rawSites = [] } = useSites();
  const devices = rawDevices as ApiDevice[];
  const sites = rawSites as ApiSite[];

  const filtered = devices.filter((d: any) => {
    if (search) {
      const s = search.toLowerCase();
      const matchName = d.name?.toLowerCase().includes(s);
      const matchIp = d.ip_address?.includes(s);
      const matchRemote = d.remote_address?.includes(s);
      const matchWan = d.site_wan_ip?.includes(s);
      if (!matchName && !matchIp && !matchRemote && !matchWan) return false;
    }
    if (brandFilter !== "all" && d.brand !== brandFilter) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (siteFilter !== "all" && d.site_id !== siteFilter) return false;
    return true;
  });

  // Stats by type
  const cameraCount = devices.filter(
    (d: any) =>
      d.type === "camera" || d.type?.includes("nvr") || d.type?.includes("dvr"),
  ).length;
  const onlineCount = devices.filter(
    (d: any) => d.status === "online" || d.status === "active",
  ).length;
  const offlineCount = devices.filter(
    (d: any) => d.status === "offline",
  ).length;
  const deviceTypes = [
    ...new Set(devices.map((d: any) => d.type).filter(Boolean)),
  ] as string[];

  const selected = selectedDevice
    ? devices.find((d) => d.id === selectedDevice)
    : null;
  const openEdit = (device: any) => {
    setEditDevice(device);
    setFormOpen(true);
  };
  const openAdd = () => {
    setEditDevice(null);
    setFormOpen(true);
  };

  const [pageTab, setPageTab] = useState("inventory");

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title={t("devices.title")}
      description="Inventario de dispositivos, cuentas cloud e integraciones"
      icon={<Video className="h-5 w-5" />}
      actions={
        pageTab === "inventory" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="mr-1 h-3 w-3" /> {t("common.import")}
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1 h-3 w-3" /> {t("devices.add_device")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col h-full">
        <div className="px-4 pt-3 border-b">
          <Tabs value={pageTab} onValueChange={setPageTab}>
            <TabsList>
              <TabsTrigger value="inventory">Inventario</TabsTrigger>
              <TabsTrigger value="cloud">Hik-Connect / DMSS</TabsTrigger>
              <TabsTrigger value="ewelink">eWeLink / Sonoff</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {pageTab === "cloud" && (
          <div className="flex-1 overflow-auto p-4">
            <CloudAccountsPanel />
          </div>
        )}

        {pageTab === "ewelink" && (
          <div className="flex-1 overflow-auto p-4">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              }
            >
              <EWeLinkCloudPanel />
            </Suspense>
          </div>
        )}

        {pageTab === "inventory" && (
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            <div
              className={cn(
                "flex-1 flex flex-col border-r",
                selected && "lg:max-w-[60%] hidden lg:flex",
              )}
            >
              <div className="px-4 py-3 border-b space-y-3">
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[150px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("devices.search")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger className="w-24 sm:w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("devices.all_brands")}
                      </SelectItem>
                      <SelectItem value="hikvision">Hikvision</SelectItem>
                      <SelectItem value="dahua">Dahua</SelectItem>
                      <SelectItem value="generic_onvif">ONVIF</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-24 sm:w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo estado</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="pending_configuration">
                        Pendiente
                      </SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-24 sm:w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo tipo</SelectItem>
                      {deviceTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          <span className="capitalize">
                            {t.replace(/_/g, " ")}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={siteFilter} onValueChange={setSiteFilter}>
                    <SelectTrigger className="w-28 sm:w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo sitio</SelectItem>
                      {sites.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={<Monitor className="h-12 w-12" />}
                    title={t("devices.no_devices") || "No hay dispositivos"}
                    description="Agrega tu primer dispositivo para comenzar o cambia los filtros."
                    action={{
                      label: t("devices.add_first") || "Agregar dispositivo",
                      onClick: openAdd,
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                    {filtered.map((device) => {
                      const site = sites.find((s) => s.id === device.site_id);
                      return (
                        <Card
                          key={device.id}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-muted/50",
                            selectedDevice === device.id && "border-primary"
                          )}
                          onClick={() => setSelectedDevice(device.id)}
                        >
                          <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                            <div className="flex flex-col">
                              <CardTitle className="text-base font-semibold flex items-center gap-2">
                                {device.status === "online" || device.status === "active" ? (
                                  <Wifi className="h-4 w-4 text-emerald-500" />
                                ) : device.status === "offline" ? (
                                  <WifiOff className="h-4 w-4 text-red-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-amber-500" />
                                )}
                                {device.name}
                              </CardTitle>
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                <span className="capitalize font-medium text-foreground">{device.brand}</span>
                                <span>{device.model || "Unknown Model"}</span>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedDevice(device.id)}>
                                  <Eye className="mr-2 h-4 w-4" /> {t("devices.view_details")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(device)}>
                                  <Pencil className="mr-2 h-4 w-4" /> {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDevice(device)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground mb-1">Firmware</span>
                                <span className="font-mono truncate">{device.firmware_version || "—"}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-muted-foreground mb-1">SDK Status</span>
                                <span>
                                  <Badge variant="outline" className="text-[10px] bg-background">
                                    {device.status === "online" ? "Connected" : "Disconnected"}
                                  </Badge>
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-muted-foreground mb-1">Canales</span>
                                <span>{device.channels || 0}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-muted-foreground mb-1">Última Com.</span>
                                <span>{device.last_seen ? new Date(device.last_seen).toLocaleString() : "—"}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <Badge
                                variant={
                                  device.status === "online" || device.status === "active"
                                    ? "default"
                                    : device.status === "offline"
                                      ? "destructive"
                                      : "secondary"
                                }
                                className="text-[10px] capitalize"
                              >
                                {device.status === "pending_configuration" ? "pendiente" : device.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // In a real scenario, this should use react-router to navigate
                                  window.location.href = `/live-view?device=${device.id}&channel=1`;
                                }}
                              >
                                <PlayCircle className="mr-1 h-3 w-3" /> LiveView
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="px-4 py-2 border-t text-xs text-muted-foreground">
                {devices.length} total • {onlineCount} online • {offlineCount}{" "}
                offline • {cameraCount} cámaras/grabadores • {filtered.length}{" "}
                mostrando
              </div>
            </div>

            {selected && (
              <div className="fixed inset-0 z-40 bg-background lg:static lg:z-auto lg:w-[40%] overflow-auto p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <button
                      onClick={() => setSelectedDevice(null)}
                      className="lg:hidden text-xs text-muted-foreground mb-2 flex items-center gap-1 hover:text-foreground"
                    >
                      &larr; {t("common.back") || "Back"}
                    </button>
                    <h2 className="font-bold">{selected.name}</h2>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selected.brand} {selected.model}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        selected.status === "online" ? "default" : "destructive"
                      }
                      className="capitalize"
                    >
                      {selected.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(selected)}
                      aria-label="Editar dispositivo"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {t("devices.connection")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        IP Pública (Remota)
                      </span>
                      <span className="font-mono text-success">
                        {selected.remote_address || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">WAN Site</span>
                      <span className="font-mono">
                        {selected.site_wan_ip || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP LAN</span>
                      <span className="font-mono">
                        {selected.ip_address || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Puerto Mapeado
                      </span>
                      <span>{selected.port || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RTSP</span>
                      <span>{String(selected.rtsp_port ?? "")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ONVIF</span>
                      <span>{String(selected.onvif_port ?? "")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("devices.firmware")}
                      </span>
                      <span className="font-mono text-xs">
                        {selected.firmware_version}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t("devices.channels")}
                      </span>
                      <span>{selected.channels}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {t("devices.capabilities")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(
                        (selected.capabilities || {}) as Record<string, any>,
                      ).map(([key, val]) => {
                        if (typeof val === "boolean" && val)
                          return (
                            <Badge
                              key={key}
                              variant="outline"
                              className="text-[10px] capitalize"
                            >
                              {key.replace(/_/g, " ")}
                            </Badge>
                          );
                        return null;
                      })}
                    </div>
                  </CardContent>
                </Card>
                {selected.tags && selected.tags.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {t("devices.tags")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {(selected.tags || []).map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {selected.notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {t("devices.notes")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {selected.notes}
                    </CardContent>
                  </Card>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        apiClient
                          .post("/device-control/test-connection", {
                            deviceId: selected.id,
                          })
                          .then((d: any) => {
                            if (d?.reachable || d?.data?.reachable)
                              toast.success(
                                `Conectado — Latencia: ${d?.latencyMs || d?.data?.latencyMs || "?"}ms`,
                              );
                            else
                              toast.error(
                                `No alcanzable: ${d?.error || d?.data?.error || "Sin respuesta"}`,
                              );
                          })
                          .catch(() => toast.error("Error al probar conexión"));
                      }}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" /> {t("common.test")}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEdit(selected)}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> {t("common.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive"
                      onClick={() => setDeleteDevice(selected)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      apiClient
                        .post(`/device-control/execute`, {
                          deviceId: selected.id,
                          command: "register-stream",
                        })
                        .then(() => {
                          toast.success(
                            `Stream registrado para ${selected.name}`,
                          );
                        })
                        .catch(() => toast.error("Error al registrar stream"));
                    }}
                  >
                    <PlayCircle className="mr-1.5 h-4 w-4" /> Registrar Stream
                    en Vista en Vivo
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const rtspUrl = `rtsp://${selected.remote_address || selected.ip_address}:${selected.rtsp_port || 554}/Streaming/Channels/101`;
                      navigator.clipboard
                        .writeText(rtspUrl)
                        .then(() => {
                          toast.success(`URL RTSP copiada al portapapeles`);
                        })
                        .catch(() => toast.info(rtspUrl));
                    }}
                  >
                    <Video className="mr-1.5 h-4 w-4" /> Copiar URL RTSP
                  </Button>
                </div>
              </div>
            )}

            <DeviceFormDialog
              open={formOpen}
              onOpenChange={setFormOpen}
              device={editDevice}
            />
            <DeleteDeviceDialog
              open={!!deleteDevice}
              onOpenChange={() => setDeleteDevice(null)}
              device={deleteDevice}
              onDeleted={() => setSelectedDevice(null)}
            />
            <DataImportDialog
              open={importOpen}
              onOpenChange={setImportOpen}
              entityType="devices"
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
