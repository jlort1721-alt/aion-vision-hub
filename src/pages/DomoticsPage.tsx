import { useState, useMemo, useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { PageShell } from "@/components/shared/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Zap,
  MoreHorizontal,
  Power,
  RefreshCw,
  Settings,
  Search,
  Plus,
  DoorOpen,
  Shield,
  Siren,
  Lightbulb,
  CircuitBoard,
  Activity,
  ToggleLeft,
  Wifi,
  WifiOff,
  Loader2,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import {
  useSections,
  useDomoticDevices,
  useDomoticMutations,
  useDomoticActions,
  useEWeLinkMCPDevices,
  useEWeLinkToggle,
} from "@/hooks/use-module-data";
import {
  useEWeLinkAuth,
  useEWeLinkControl,
  useEWeLinkSync,
  useEWeLinkHealth,
  useEWeLinkLogs,
} from "@/hooks/use-ewelink";

import { TYPE_ICONS, TYPE_LABELS } from "./domotics/types";

const ICON_MAP: Record<string, any> = {
  DoorOpen,
  Shield,
  Siren,
  Lightbulb,
  CircuitBoard,
  Activity,
  ToggleLeft,
};
import { DomoticsHeader } from "./domotics/components/DomoticsHeader";
import { DeviceSidebar } from "./domotics/components/DeviceSidebar";
import ScenesPanel from "@/components/domotics/ScenesPanel";
import SchedulePanel from "@/components/domotics/SchedulePanel";

// ── eWeLink Device Card ──────────────────────────────────

function EWeLinkDeviceCard({
  device,
  onToggle,
  isPending,
}: {
  device: Record<string, unknown>;
  onToggle: (device: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const online = Boolean(device.online);
  const params = (device.params ?? {}) as Record<string, unknown>;
  const switchState =
    typeof params.switch === "string" ? params.switch : undefined;
  const isOn = switchState === "on";
  const name =
    (device.name as string) || (device.deviceid as string) || "Unknown";
  const brand = (device.brandName as string) || "";
  const model = (device.productModel as string) || "";

  return (
    <Card className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header: name + online dot */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3
            className="font-semibold text-sm truncate leading-tight"
            title={name}
          >
            {name}
          </h3>
          {(brand || model) && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {brand} {model}
            </p>
          )}
        </div>
        <span
          className={`mt-1 shrink-0 h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
          title={online ? "Online" : "Offline"}
        />
      </div>

      {/* State indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {online ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className="text-xs text-muted-foreground">
            {online ? t("common.online") : t("common.offline")}
          </span>
        </div>
        {switchState !== undefined && (
          <Badge
            variant={isOn ? "default" : "secondary"}
            className="text-[10px]"
          >
            {isOn ? "ON" : "OFF"}
          </Badge>
        )}
      </div>

      {/* Toggle control */}
      {switchState !== undefined && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs font-medium">
            {t("domotics.power_state")}
          </span>
          <div className="flex items-center gap-2">
            {isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={isOn}
              onCheckedChange={() => onToggle(device)}
              disabled={isPending || !online}
            />
          </div>
        </div>
      )}

      {/* Device ID */}
      <p
        className="text-[9px] font-mono text-muted-foreground/60 select-all truncate"
        title={String(device.deviceid)}
      >
        ID: {String(device.deviceid)}
      </p>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────

export default function DomoticsPage() {
  const { t } = useI18n();
  const { data: rawSections = [], isLoading: sectionsLoading } = useSections();
  const {
    data: rawDevices = [],
    isLoading: devicesLoading,
    isError,
    refetch,
  } = useDomoticDevices();
  const sections = rawSections as Record<string, unknown>[];
  const devices = rawDevices as Record<string, unknown>[];
  const { create, toggleState, remove } = useDomoticMutations();

  // eWeLink MCP devices from backend
  const {
    data: ewelinkDevices = [],
    isLoading: ewelinkLoading,
    refetch: refetchEwelink,
  } = useEWeLinkMCPDevices();
  const ewelinkToggle = useEWeLinkToggle();

  // eWeLink Hooks (auth/health/sync)
  const ewelinkAuth = useEWeLinkAuth();
  const ewelinkControl = useEWeLinkControl();
  const ewelinkSync = useEWeLinkSync();
  const { data: ewelinkHealth } = useEWeLinkHealth();
  const { data: ewelinkLogs = [] } = useEWeLinkLogs(30);

  // State
  const [activeTab, setActiveTab] = useState("ewelink");
  const [ewelinkSearch, setEwelinkSearch] = useState("");
  const [ewelinkStatusFilter, setEwelinkStatusFilter] = useState<
    "all" | "online" | "offline"
  >("all");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deleteDeviceId, setDeleteDeviceId] = useState<string | null>(null);

  const selectedDevice = useMemo(
    () =>
      selectedDeviceId
        ? devices.find((d: any) => d.id === selectedDeviceId)
        : null,
    [selectedDeviceId, devices],
  );

  const { data: actions = [], isLoading: actionsLoading } = useDomoticActions(
    selectedDeviceId ?? undefined,
  );

  // Statistics (DB devices)
  const onlineCount = devices.filter((d: any) => d.status === "online").length;
  const errorCount = devices.filter(
    (d: any) => d.status === "error" || d.status === "offline",
  ).length;
  const activeCount = devices.filter((d: any) => d.state === "on").length;

  // eWeLink statistics
  const ewOnlineCount = ewelinkDevices.filter((d: any) =>
    Boolean(d.online),
  ).length;
  const ewOfflineCount = ewelinkDevices.length - ewOnlineCount;
  const ewActiveCount = ewelinkDevices.filter((d: any) => {
    const p = (d.params ?? {}) as Record<string, unknown>;
    return p.switch === "on";
  }).length;

  // Combined counts for header KPI when on eWeLink tab
  const headerDevicesCount =
    activeTab === "ewelink" ? ewelinkDevices.length : devices.length;
  const headerOnlineCount =
    activeTab === "ewelink" ? ewOnlineCount : onlineCount;
  const headerErrorCount =
    activeTab === "ewelink" ? ewOfflineCount : errorCount;
  const headerActiveCount =
    activeTab === "ewelink" ? ewActiveCount : activeCount;

  // eWeLink toggle handler
  const handleEwelinkToggle = useCallback(
    (device: Record<string, unknown>) => {
      const params = (device.params ?? {}) as Record<string, unknown>;
      const currentlyOn = params.switch === "on";
      ewelinkToggle.mutate({
        deviceId: String(device.deviceid),
        on: !currentlyOn,
      });
    },
    [ewelinkToggle],
  );

  // Filtered eWeLink devices
  const filteredEwelinkDevices = useMemo(() => {
    return ewelinkDevices.filter((d: any) => {
      // Status filter
      if (ewelinkStatusFilter === "online" && !d.online) return false;
      if (ewelinkStatusFilter === "offline" && d.online) return false;
      // Search filter
      if (ewelinkSearch.trim()) {
        const q = ewelinkSearch.toLowerCase();
        const name = String(d.name || "").toLowerCase();
        const brand = String(d.brandName || "").toLowerCase();
        const model = String(d.productModel || "").toLowerCase();
        const id = String(d.deviceid || "").toLowerCase();
        if (
          !name.includes(q) &&
          !brand.includes(q) &&
          !model.includes(q) &&
          !id.includes(q)
        )
          return false;
      }
      return true;
    });
  }, [ewelinkDevices, ewelinkSearch, ewelinkStatusFilter]);

  // Actions (DB devices)
  const handleTestConnection = useCallback(
    async (device: any) => {
      if (!device.config?.ewelink_id) {
        toast.info(
          `Test de conexion para "${device.name}" -- sin eWeLink ID asociado`,
        );
        return;
      }
      if (!ewelinkAuth.isAuthenticated) {
        toast.warning("Inicia sesion en eWeLink para probar la conexion real");
        return;
      }
      const { ewelink } = await import("@/services/integrations/ewelink");
      const state = await ewelink.getDeviceState(device.config.ewelink_id);
      if (state.success) {
        toast.success(
          `Conexion exitosa con "${device.name}" -- dispositivo ${device.status}`,
        );
      } else {
        toast.error(`Fallo de conexion: ${state.error}`);
      }
    },
    [ewelinkAuth.isAuthenticated],
  );

  const handleToggle = useCallback(
    (device: any) => {
      if (ewelinkAuth.isAuthenticated && device.config?.ewelink_id) {
        ewelinkControl.mutate({
          deviceId: device.config.ewelink_id,
          action: "toggle",
        });
      }
      toggleState.mutate({ id: device.id, currentState: device.state });
    },
    [ewelinkAuth.isAuthenticated, ewelinkControl, toggleState],
  );

  const handleDirectAction = (device: any, action: "on" | "off") => {
    if (ewelinkAuth.isAuthenticated && device.config?.ewelink_id) {
      ewelinkControl.mutate({ deviceId: device.config.ewelink_id, action });
    }
    toggleState.mutate({
      id: device.id,
      currentState: action === "on" ? "off" : "on",
    });
  };

  // DataTable Columns (DB devices)
  const getSectionName = useCallback(
    (id: string) => sections.find((s: any) => s.id === id)?.name || "--",
    [sections],
  );

  const columns = useMemo(
    () => [
      {
        key: "type_icon",
        header: "",
        width: "w-10 text-center",
        cell: (row: any) => {
          const iconName = TYPE_ICONS[row.type as keyof typeof TYPE_ICONS];
          const Icon = (iconName && ICON_MAP[iconName]) || Zap;
          return <Icon className="h-4 w-4 text-muted-foreground mx-auto" />;
        },
      },
      {
        key: "name",
        header: t("common.name"),
        sortable: true,
        cell: (row: any) => (
          <span className="font-medium text-sm">{row.name}</span>
        ),
      },
      {
        key: "type",
        header: t("common.type"),
        sortable: true,
        cell: (row: any) => (
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-normal"
          >
            {TYPE_LABELS[row.type] || row.type}
          </Badge>
        ),
      },
      {
        key: "section",
        header: t("domotics.section"),
        cell: (row: any) => (
          <span className="text-xs text-muted-foreground">
            {getSectionName(row.section_id)}
          </span>
        ),
      },
      {
        key: "brand",
        header: t("domotics.brand_model"),
        cell: (row: any) => (
          <span className="text-xs">
            {row.brand} {row.model}
          </span>
        ),
      },
      {
        key: "status",
        header: t("common.status"),
        sortable: true,
        cell: (row: any) => (
          <StatusBadge
            status={row.status}
            variant="device"
            pulse={row.status === "online"}
          />
        ),
      },
      {
        key: "state",
        header: t("domotics.state"),
        sortable: "state",
        cell: (row: any) => (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={row.state} variant="generic" />
          </div>
        ),
      },
      {
        key: "actions",
        header: "",
        width: "w-12 text-right",
        cell: (row: any) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(row);
                }}
              >
                <Power className="mr-2 h-3 w-3" /> {t("domotics.toggle")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleTestConnection(row);
                }}
              >
                <RefreshCw className="mr-2 h-3 w-3" />{" "}
                {t("domotics.test_connection")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDeviceId(row.id);
                }}
              >
                <Settings className="mr-2 h-3 w-3" /> {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, remove, getSectionName, handleTestConnection, handleToggle],
  );

  const searchFilterLine = (row: any, searchStr: string) => {
    if (sectionFilter !== "all" && row.section_id !== sectionFilter)
      return false;
    if (typeFilter !== "all" && row.type !== typeFilter) return false;
    if (!searchStr) return true;
    return (
      (row.name || "").toLowerCase().includes(searchStr.toLowerCase()) ||
      (row.brand && row.brand.toLowerCase().includes(searchStr.toLowerCase()))
    );
  };

  if (isError)
    return (
      <div className="p-6 text-center text-destructive">
        {t("domotics.error_loading")}{" "}
        <Button variant="outline" onClick={() => refetch()}>
          {t("domotics.retry")}
        </Button>
      </div>
    );

  return (
    <>
      <PageShell
        title={t("domotics.title")}
        description={t("domotics.subtitle")}
        icon={<Zap size={20} />}
        actions={
          <div className="flex items-center gap-3">
            {activeTab === "db" && (
              <>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-background">
                    <SelectValue placeholder={t("domotics.all_sections")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("domotics.all_sections")}
                    </SelectItem>
                    {sections.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-background">
                    <SelectValue placeholder={t("domotics.all_types")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("domotics.all_types")}
                    </SelectItem>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        }
      >
        <div className="p-4 flex gap-4 min-h-full bg-background">
          <div className="flex-1 flex flex-col min-w-0">
            <DomoticsHeader
              devicesCount={headerDevicesCount}
              onlineCount={headerOnlineCount}
              errorCount={headerErrorCount}
              activeCount={headerActiveCount}
              ewelinkAuth={ewelinkAuth}
              ewelinkHealth={ewelinkHealth}
              isSyncing={ewelinkSync.isPending}
              onSync={() =>
                ewelinkSync.mutate(undefined, {
                  onSuccess: () => {
                    refetch();
                    refetchEwelink();
                  },
                })
              }
              onRefresh={() => {
                refetch();
                refetchEwelink();
              }}
              onAddDevice={() => {
                setEditingDeviceId(null);
                setAddOpen(true);
              }}
              onOpenLogin={() => setLoginOpen(true)}
              onOpenLogs={() => setLogsOpen(true)}
            />

            {/* ── Tab Layout ── */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="mt-4 flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="shrink-0">
                <TabsTrigger value="ewelink" className="gap-1.5">
                  <Cloud className="h-3.5 w-3.5" />
                  eWeLink
                  {ewelinkDevices.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 text-[10px] px-1.5 py-0"
                    >
                      {ewelinkDevices.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="db" className="gap-1.5">
                  <CircuitBoard className="h-3.5 w-3.5" />
                  {t("domotics.tab_database")}
                  {devices.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 text-[10px] px-1.5 py-0"
                    >
                      {devices.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="scenes" className="gap-1.5">
                  {t("scenes.title")}
                </TabsTrigger>
                <TabsTrigger value="schedules" className="gap-1.5">
                  {t("schedule.title")}
                </TabsTrigger>
              </TabsList>

              {/* ── eWeLink Tab ── */}
              <TabsContent
                value="ewelink"
                className="flex-1 flex flex-col overflow-hidden mt-0"
              >
                {/* Search bar */}
                <div className="flex items-center gap-2 mb-3 mt-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={t("domotics.search_ewelink")}
                      value={ewelinkSearch}
                      onChange={(e) => setEwelinkSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center border rounded-md">
                    {(["all", "online", "offline"] as const).map((s) => (
                      <Button
                        key={s}
                        variant={
                          ewelinkStatusFilter === s ? "default" : "ghost"
                        }
                        size="sm"
                        className="h-8 text-xs rounded-none first:rounded-l-md last:rounded-r-md px-3"
                        onClick={() => setEwelinkStatusFilter(s)}
                      >
                        {s === "all"
                          ? t("common.all")
                          : s === "online"
                            ? `${t("common.online")} (${ewOnlineCount})`
                            : `${t("common.offline")} (${ewOfflineCount})`}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => refetchEwelink()}
                  >
                    <RefreshCw className="mr-1.5 h-3 w-3" />{" "}
                    {t("common.refresh")}
                  </Button>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {filteredEwelinkDevices.length} de {ewelinkDevices.length}{" "}
                    {t("domotics.devices_count")}
                  </span>
                </div>

                {/* Device Grid */}
                <div className="flex-1 overflow-auto">
                  {ewelinkLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        {t("domotics.loading_ewelink")}
                      </span>
                    </div>
                  ) : filteredEwelinkDevices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <WifiOff className="h-10 w-10 mb-3 opacity-40" />
                      <p className="text-sm font-medium">
                        {ewelinkDevices.length === 0
                          ? t("domotics.no_ewelink_devices")
                          : t("domotics.no_match")}
                      </p>
                      <p className="text-xs mt-1">
                        {ewelinkDevices.length === 0
                          ? t("domotics.verify_ewelink_connection")
                          : t("domotics.try_other_search")}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {filteredEwelinkDevices.map((device: any) => (
                        <EWeLinkDeviceCard
                          key={String(device.deviceid || device.id)}
                          device={device}
                          onToggle={handleEwelinkToggle}
                          isPending={ewelinkToggle.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── DB Devices Tab ── */}
              <TabsContent
                value="db"
                className="flex-1 flex flex-col overflow-hidden mt-0"
              >
                <div className="mt-3 flex-1 bg-background rounded-lg border shadow-sm flex flex-col overflow-hidden">
                  <DataTable
                    columns={columns}
                    data={devices}
                    getRowId={(row) => row.id}
                    isLoading={sectionsLoading || devicesLoading}
                    searchPlaceholder={t("domotics.search")}
                    searchFilter={searchFilterLine}
                    onRowClick={(row) =>
                      setSelectedDeviceId(
                        row.id === selectedDeviceId ? null : row.id,
                      )
                    }
                    className="flex-1 p-0 border-0"
                  />
                </div>
              </TabsContent>

              {/* ── Escenas Tab ── */}
              <TabsContent value="scenes" className="flex-1 overflow-auto mt-0">
                <ScenesPanel />
              </TabsContent>

              {/* ── Programación Tab ── */}
              <TabsContent
                value="schedules"
                className="flex-1 overflow-auto mt-0"
              >
                <SchedulePanel />
              </TabsContent>
            </Tabs>
          </div>

          {selectedDevice && activeTab === "db" && (
            <DeviceSidebar
              device={selectedDevice}
              sectionName={getSectionName(selectedDevice.section_id)}
              actions={actions}
              actionsLoading={actionsLoading}
              ewelinkControlPending={ewelinkControl.isPending}
              onToggle={handleToggle}
              onDirectAction={handleDirectAction}
              onTestConnection={handleTestConnection}
              onEdit={() => {
                setEditingDeviceId(selectedDevice.id);
                setAddOpen(true);
              }}
            />
          )}
        </div>
      </PageShell>

      {/* ── Delete Device Confirmation ─── */}
      <AlertDialog
        open={!!deleteDeviceId}
        onOpenChange={(open) => {
          if (!open) setDeleteDeviceId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("domotics.confirm_delete_device")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteDeviceId) {
                  remove.mutate(deleteDeviceId);
                  setDeleteDeviceId(null);
                }
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add/Edit Device Dialog ─── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              {editingDeviceId
                ? t("domotics.edit_device")
                : t("domotics.add_device")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("common.name")}
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md p-2 text-sm bg-background"
                  placeholder={t("domotics.device_name_placeholder")}
                  id="device-name-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("common.type")}
                </label>
                <select
                  className="w-full border rounded-md p-2 text-sm bg-background"
                  id="device-type-input"
                >
                  <option value="switch">{t("domotics.type_switch")}</option>
                  <option value="light">{t("domotics.type_light")}</option>
                  <option value="sensor">{t("domotics.type_sensor")}</option>
                  <option value="camera">{t("domotics.type_camera")}</option>
                  <option value="lock">{t("domotics.type_lock")}</option>
                  <option value="siren">{t("domotics.type_siren")}</option>
                  <option value="other">{t("domotics.type_other")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("domotics.location")}
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md p-2 text-sm bg-background"
                  placeholder={t("domotics.location_placeholder")}
                  id="device-location-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
                onClick={() => {
                  setAddOpen(false);
                  setEditingDeviceId(null);
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                onClick={async () => {
                  const name = (
                    document.getElementById(
                      "device-name-input",
                    ) as HTMLInputElement
                  )?.value;
                  const type = (
                    document.getElementById(
                      "device-type-input",
                    ) as HTMLSelectElement
                  )?.value;
                  const location = (
                    document.getElementById(
                      "device-location-input",
                    ) as HTMLInputElement
                  )?.value;
                  if (!name?.trim()) {
                    toast.error(t("domotics.name_required"));
                    return;
                  }
                  try {
                    if (editingDeviceId) {
                      await apiClient.patch(
                        `/domotics/devices/${editingDeviceId}`,
                        { name, device_type: type, location },
                      );
                      toast.success(t("domotics.device_updated"));
                    } else {
                      await apiClient.post("/domotics/devices", {
                        name,
                        device_type: type,
                        location,
                        site_id: selectedSite,
                      });
                      toast.success(t("domotics.device_added"));
                    }
                    queryClient.invalidateQueries({ queryKey: ["domotics"] });
                    setAddOpen(false);
                    setEditingDeviceId(null);
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : t("common.error"),
                    );
                  }
                }}
              >
                {editingDeviceId ? t("common.save") : t("domotics.add_device")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
