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
import {
  Search,
  Camera,
  Grid3x3,
  LayoutGrid,
  RefreshCw,
  MapPin,
  Activity,
} from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { LiveVideoPlayer } from "@/components/streams/LiveVideoPlayer";
import { apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-utils";

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

type GridSize = "1" | "2" | "4" | "9" | "16";

export default function LiveStreamsPage() {
  const [devices, setDevices] = useState<DeviceStreams[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [gridSize, setGridSize] = useState<GridSize>("4");
  const [selectedStreams, setSelectedStreams] = useState<
    Array<{ deviceId: string; deviceName: string; channel: number }>
  >([]);

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
  }, [loadStreams]);

  const sites = useMemo(() => {
    const s = new Set(devices.map((d) => d.site_name).filter(Boolean));
    return Array.from(s).sort();
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (brandFilter !== "all" && d.brand !== brandFilter) return false;
      if (siteFilter !== "all" && d.site_name !== siteFilter) return false;
      if (
        search &&
        !d.device_name.toLowerCase().includes(search.toLowerCase()) &&
        !(d.site_name?.toLowerCase() ?? "").includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [devices, search, brandFilter, siteFilter]);

  const allChannels = useMemo(() => {
    const list: Array<{
      deviceId: string;
      deviceName: string;
      channel: number;
      streamKey: string;
    }> = [];
    filteredDevices.forEach((d) => {
      d.streams.forEach((s) => {
        list.push({
          deviceId: d.device_id,
          deviceName: d.device_name,
          channel: s.channel,
          streamKey: s.stream_key,
        });
      });
    });
    return list;
  }, [filteredDevices]);

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
      if (prev.length >= max)
        return [
          ...prev.slice(1),
          { deviceId: d.device_id, deviceName: d.device_name, channel: ch },
        ];
      return [
        ...prev,
        { deviceId: d.device_id, deviceName: d.device_name, channel: ch },
      ];
    });
  };

  const gridCols = useMemo(() => {
    switch (gridSize) {
      case "1":
        return "grid-cols-1";
      case "2":
        return "grid-cols-2";
      case "4":
        return "grid-cols-2 lg:grid-cols-2";
      case "9":
        return "grid-cols-3";
      case "16":
        return "grid-cols-4";
      default:
        return "grid-cols-2";
    }
  }, [gridSize]);

  const totalActiveStreams = devices.reduce(
    (sum, d) => sum + d.active_channels,
    0,
  );

  return (
    <PageShell
      title="Video en Vivo"
      description={`${totalActiveStreams} streams activos en ${devices.length} dispositivos`}
      actions={
        <Button
          onClick={loadStreams}
          disabled={loading}
          size="sm"
          variant="outline"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Recargar
        </Button>
      }
    >
      <Tabs defaultValue="mural" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mural">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Mural
          </TabsTrigger>
          <TabsTrigger value="devices">
            <Grid3x3 className="h-4 w-4 mr-2" />
            Por dispositivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mural">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o sitio..."
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
                      <SelectItem key={s} value={s!}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={gridSize}
                  onValueChange={(v) => setGridSize(v as GridSize)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1×</SelectItem>
                    <SelectItem value="2">2×</SelectItem>
                    <SelectItem value="4">4×</SelectItem>
                    <SelectItem value="9">9×</SelectItem>
                    <SelectItem value="16">16×</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {selectedStreams.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>
                    Selecciona canales en la pestaña "Por dispositivo" para ver
                    aquí el mural.
                  </p>
                </div>
              ) : (
                <div className={`grid gap-2 ${gridCols}`}>
                  {selectedStreams.map((s) => (
                    <LiveVideoPlayer
                      key={`${s.deviceId}_${s.channel}`}
                      deviceId={s.deviceId}
                      deviceName={s.deviceName}
                      channel={s.channel}
                      height={240}
                      defaultQuality="sub"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredDevices.map((d) => (
              <Card key={d.device_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge
                        variant={d.status === "online" ? "default" : "outline"}
                        className="text-xs"
                      >
                        <Activity className="h-3 w-3 mr-1" />
                        {d.status}
                      </Badge>
                      {d.device_name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {d.brand}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {d.site_name && (
                      <>
                        <MapPin className="h-3 w-3" />
                        {d.site_name}
                      </>
                    )}
                    <span className="ml-auto">
                      {d.active_channels}/{d.total_channels} canales
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1">
                    {d.streams.map((s) => {
                      const selected = selectedStreams.some(
                        (x) =>
                          x.deviceId === d.device_id && x.channel === s.channel,
                      );
                      return (
                        <Button
                          key={s.channel}
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => toggleSelect(d, s.channel)}
                        >
                          Ch{s.channel}
                        </Button>
                      );
                    })}
                    {d.streams.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Sin streams activos
                      </span>
                    )}
                  </div>
                  {d.last_seen && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Última sesión: {formatDateTime(d.last_seen)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
