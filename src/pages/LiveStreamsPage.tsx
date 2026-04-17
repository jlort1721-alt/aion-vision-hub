import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Camera,
  Grid3x3,
  LayoutGrid,
  RefreshCw,
  MapPin,
  Activity,
  Wifi,
  WifiOff,
  Circle,
  X,
  Sparkles,
  Maximize2,
} from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { LiveVideoPlayer } from "@/components/streams/LiveVideoPlayer";
import { apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-utils";
import { useLiveEvents } from "@/hooks/use-live-events";
import { cn } from "@/lib/utils";

interface StreamEntry {
  channel: number;
  stream_key: string;
}

interface DeviceStreams {
  device_id: string;
  device_name: string;
  brand: string;
  site_id: string | null;
  site_name: string | null;
  status: string;
  last_seen: string | null;
  total_channels: number;
  active_channels: number;
  streams: StreamEntry[];
}

type GridSize = "1" | "2" | "4" | "9" | "16" | "25";

interface SelectedChannel {
  deviceId: string;
  deviceName: string;
  channel: number;
  brand: string;
}

const STORAGE_KEY = "aion-live-streams-selection";

export default function LiveStreamsPage() {
  const [devices, setDevices] = useState<DeviceStreams[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gridSize, setGridSize] = useState<GridSize>("4");
  const [selectedStreams, setSelectedStreams] = useState<SelectedChannel[]>(
    () => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      } catch {
        return [];
      }
    },
  );

  // Persist selection
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedStreams));
  }, [selectedStreams]);

  const { connected: wsConnected, events: wsEvents } = useLiveEvents({
    channels: ["events", "motion_events", "isapi_events"],
  });

  const loadStreams = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiClient.get<{
        success: boolean;
        data: DeviceStreams[];
        meta: { total_streams: number };
      }>("/api/streams/list");
      setDevices(resp.data ?? []);
    } catch (err) {
      console.error("Failed to load streams", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStreams();
    const interval = setInterval(loadStreams, 30000);
    return () => clearInterval(interval);
  }, [loadStreams]);

  const sites = useMemo(() => {
    const s = new Set(devices.map((d) => d.site_name).filter(Boolean));
    return Array.from(s).sort() as string[];
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (brandFilter !== "all" && d.brand !== brandFilter) return false;
      if (siteFilter !== "all" && d.site_name !== siteFilter) return false;
      if (statusFilter === "online" && d.status !== "online") return false;
      if (statusFilter === "with-streams" && d.active_channels === 0)
        return false;
      if (
        search &&
        !d.device_name.toLowerCase().includes(search.toLowerCase()) &&
        !(d.site_name?.toLowerCase() ?? "").includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [devices, search, brandFilter, siteFilter, statusFilter]);

  const toggleSelect = (d: DeviceStreams, ch: number) => {
    const max = parseInt(gridSize, 10);
    setSelectedStreams((prev) => {
      const exists = prev.find(
        (s) => s.deviceId === d.device_id && s.channel === ch,
      );
      if (exists)
        return prev.filter(
          (s) => !(s.deviceId === d.device_id && s.channel === ch),
        );
      const next: SelectedChannel = {
        deviceId: d.device_id,
        deviceName: d.device_name,
        channel: ch,
        brand: d.brand,
      };
      if (prev.length >= max) return [...prev.slice(1), next];
      return [...prev, next];
    });
  };

  const clearSelection = () => setSelectedStreams([]);

  const selectAllFromDevice = (d: DeviceStreams) => {
    const max = parseInt(gridSize, 10);
    const channels = d.streams.slice(0, max).map((s) => ({
      deviceId: d.device_id,
      deviceName: d.device_name,
      channel: s.channel,
      brand: d.brand,
    }));
    setSelectedStreams(channels);
  };

  const gridCols = useMemo(() => {
    switch (gridSize) {
      case "1":
        return "grid-cols-1";
      case "2":
        return "grid-cols-1 md:grid-cols-2";
      case "4":
        return "grid-cols-2";
      case "9":
        return "grid-cols-3";
      case "16":
        return "grid-cols-4";
      case "25":
        return "grid-cols-5";
      default:
        return "grid-cols-2";
    }
  }, [gridSize]);

  const wallHeight = useMemo(() => {
    switch (gridSize) {
      case "1":
        return 720;
      case "2":
        return 420;
      case "4":
        return 280;
      case "9":
        return 200;
      case "16":
        return 160;
      case "25":
        return 130;
      default:
        return 240;
    }
  }, [gridSize]);

  const stats = useMemo(() => {
    const totalActive = devices.reduce((sum, d) => sum + d.active_channels, 0);
    const onlineCount = devices.filter((d) => d.status === "online").length;
    const byBrand = devices.reduce<Record<string, number>>((acc, d) => {
      acc[d.brand] = (acc[d.brand] || 0) + d.active_channels;
      return acc;
    }, {});
    return { totalActive, onlineCount, byBrand };
  }, [devices]);

  return (
    <PageShell
      title="Video en Vivo"
      description={`${stats.totalActive} streams activos · ${stats.onlineCount}/${devices.length} devices online · WebSocket ${wsConnected ? "conectado" : "desconectado"}${wsEvents.length > 0 ? ` · ${wsEvents.length} eventos` : ""}`}
      actions={
        <div className="flex gap-2">
          {selectedStreams.length > 0 && (
            <Button
              onClick={clearSelection}
              size="sm"
              variant="outline"
              className="text-red-400 border-red-400/30"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar ({selectedStreams.length})
            </Button>
          )}
          <Button
            onClick={loadStreams}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
            />
            Recargar
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="mural" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="mural">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Mural ({selectedStreams.length})
          </TabsTrigger>
          <TabsTrigger value="devices">
            <Grid3x3 className="h-4 w-4 mr-2" />
            Por dispositivo
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Sparkles className="h-4 w-4 mr-2" />
            Estadísticas
          </TabsTrigger>
        </TabsList>

        {/* ============================ MURAL ============================ */}
        <TabsContent value="mural">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={wsConnected ? "default" : "outline"}
                    className="text-xs"
                  >
                    {wsConnected ? (
                      <Wifi className="h-3 w-3 mr-1" />
                    ) : (
                      <WifiOff className="h-3 w-3 mr-1" />
                    )}
                    WS {wsConnected ? "LIVE" : "OFFLINE"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Activity className="h-3 w-3 mr-1" />
                    {selectedStreams.length}/{gridSize} streams
                  </Badge>
                </div>
                <Select
                  value={gridSize}
                  onValueChange={(v) => setGridSize(v as GridSize)}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1× (Solo)</SelectItem>
                    <SelectItem value="2">2× (Par)</SelectItem>
                    <SelectItem value="4">4× (2×2)</SelectItem>
                    <SelectItem value="9">9× (3×3)</SelectItem>
                    <SelectItem value="16">16× (4×4)</SelectItem>
                    <SelectItem value="25">25× (5×5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {selectedStreams.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                  <Camera className="h-16 w-16 mx-auto mb-3 opacity-30" />
                  <p className="text-sm mb-4">
                    Selecciona canales en la pestaña "Por dispositivo"
                  </p>
                  <div className="flex gap-2 justify-center text-xs flex-wrap">
                    {Object.entries(stats.byBrand).map(([brand, count]) => (
                      <Badge
                        key={brand}
                        variant="outline"
                        className="capitalize"
                      >
                        {brand}: {count} streams
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={cn("grid gap-2", gridCols)}>
                  {selectedStreams.map((s) => (
                    <LiveVideoPlayer
                      key={`${s.deviceId}_${s.channel}`}
                      deviceId={s.deviceId}
                      deviceName={s.deviceName}
                      channel={s.channel}
                      height={wallHeight}
                      defaultQuality="sub"
                      compact={gridSize === "16" || gridSize === "25"}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================ DEVICES ============================ */}
        <TabsContent value="devices">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o sitio…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas marcas</SelectItem>
                    <SelectItem value="hikvision">Hikvision</SelectItem>
                    <SelectItem value="dahua">Dahua</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos sitios</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos estados</SelectItem>
                    <SelectItem value="online">Solo online</SelectItem>
                    <SelectItem value="with-streams">Con streams</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[70vh] p-3">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredDevices.map((d) => {
                    const online = d.status === "online";
                    const hasStreams = d.active_channels > 0;
                    return (
                      <Card
                        key={d.device_id}
                        className={cn(
                          "transition-all",
                          hasStreams && "border-emerald-500/30",
                          !online && "opacity-70",
                        )}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 mb-1">
                                <Circle
                                  className={cn(
                                    "h-2 w-2",
                                    online
                                      ? "fill-emerald-500 text-emerald-500"
                                      : "fill-gray-400 text-gray-400",
                                  )}
                                />
                                <CardTitle className="text-sm truncate">
                                  {d.device_name}
                                </CardTitle>
                              </div>
                              {d.site_name && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {d.site_name}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-[10px] capitalize shrink-0"
                            >
                              {d.brand}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>
                              {d.active_channels}/{d.total_channels} canales
                            </span>
                            {hasStreams && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px]"
                                onClick={() => selectAllFromDevice(d)}
                              >
                                <Maximize2 className="h-3 w-3 mr-1" />
                                Ver todos
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {d.streams.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">
                              Sin streams go2rtc registrados
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {d.streams.map((s) => {
                                const selected = selectedStreams.some(
                                  (x) =>
                                    x.deviceId === d.device_id &&
                                    x.channel === s.channel,
                                );
                                return (
                                  <Button
                                    key={s.channel}
                                    size="sm"
                                    variant={selected ? "default" : "outline"}
                                    className="h-7 text-xs px-2"
                                    onClick={() => toggleSelect(d, s.channel)}
                                  >
                                    Ch{s.channel}
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                          {d.last_seen && (
                            <p className="text-[10px] text-muted-foreground mt-2">
                              Visto: {formatDateTime(d.last_seen)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {filteredDevices.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Sin resultados con los filtros aplicados
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================ STATS ============================ */}
        <TabsContent value="stats">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">
                  Streams activos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalActive}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  go2rtc producer activo
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">
                  Devices online
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-500">
                  {stats.onlineCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  de {devices.length} registrados
                </p>
              </CardContent>
            </Card>
            {Object.entries(stats.byBrand).map(([brand, count]) => (
              <Card key={brand}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground capitalize">
                    {brand}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground mt-1">streams</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="mt-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Eventos live (WebSocket)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wsEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Sin eventos recibidos
                </p>
              ) : (
                <ScrollArea className="h-60">
                  <div className="space-y-1 font-mono text-[10px]">
                    {wsEvents.slice(0, 50).map((e, i) => (
                      <div
                        key={i}
                        className="flex gap-2 p-1 border-b border-border/50"
                      >
                        <span className="text-muted-foreground shrink-0">
                          {new Date(e.receivedAt).toLocaleTimeString()}
                        </span>
                        <Badge variant="outline" className="text-[9px] h-4">
                          {e.channel}
                        </Badge>
                        <span className="truncate">
                          {JSON.stringify(e.payload).slice(0, 120)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
