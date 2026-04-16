import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  FileVideo,
  HardDrive,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { hikBridgeApi } from "@/services/hik-bridge-api";
import type {
  HikRecordingFile,
  HikDownloadStatus,
} from "@/services/hik-bridge-api";
import { toast } from "sonner";

interface RecordingDownloadProps {
  deviceIp?: string;
  channel?: number;
}

export default function RecordingDownload({
  deviceIp = "",
  channel = 1,
}: RecordingDownloadProps) {
  const queryClient = useQueryClient();
  const [searchIp, setSearchIp] = useState(deviceIp);
  const [searchChannel, setSearchChannel] = useState(channel);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchResults, setSearchResults] = useState<HikRecordingFile[]>([]);

  // Poll active downloads
  const { data: downloadsData } = useQuery({
    queryKey: ["hik-bridge", "downloads"],
    queryFn: () => hikBridgeApi.listDownloads(),
    refetchInterval: 3_000,
  });

  const downloads: HikDownloadStatus[] = downloadsData?.data ?? [];
  const activeDownloads = downloads.filter((d) => d.status === "downloading");

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: () =>
      hikBridgeApi.searchRecordings({
        device_ip: searchIp,
        channel: searchChannel,
        start_time: new Date(startDate).toISOString(),
        end_time: new Date(endDate).toISOString(),
      }),
    onSuccess: (data) => {
      const files = data?.data ?? [];
      setSearchResults(files);
      if (files.length === 0) {
        toast.info("No se encontraron grabaciones en ese rango");
      } else {
        toast.success(`${files.length} grabaciones encontradas`);
      }
    },
    onError: () => toast.error("Error al buscar grabaciones"),
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: (file: HikRecordingFile) =>
      hikBridgeApi.startDownload({
        device_ip: searchIp,
        filename: file.filename,
        channel: file.channel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hik-bridge", "downloads"] });
      toast.success("Descarga iniciada");
    },
    onError: () => toast.error("Error al iniciar descarga"),
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDateTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "downloading":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5" />
            Buscar Grabaciones (SDK)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div>
              <Label className="text-xs">IP Dispositivo</Label>
              <Input
                value={searchIp}
                onChange={(e) => setSearchIp(e.target.value)}
                placeholder="192.168.1.100"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Canal</Label>
              <Input
                type="number"
                value={searchChannel}
                onChange={(e) =>
                  setSearchChannel(parseInt(e.target.value) || 1)
                }
                min={1}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => searchMutation.mutate()}
                disabled={
                  !searchIp ||
                  !startDate ||
                  !endDate ||
                  searchMutation.isPending
                }
                size="sm"
                className="w-full"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Search className="mr-1 h-3 w-3" />
                )}
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileVideo className="h-5 w-5" />
              Resultados ({searchResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {searchResults.map((file, idx) => (
                  <div
                    key={`${file.filename}-${idx}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <FileVideo className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-mono text-xs">{file.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(file.start_time)} —{" "}
                          {formatDateTime(file.end_time)}
                          {file.file_size > 0 &&
                            ` · ${formatFileSize(file.file_size)}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadMutation.mutate(file)}
                      disabled={downloadMutation.isPending}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Descargar
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Active Downloads */}
      {downloads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-5 w-5" />
              Descargas ({downloads.length})
              {activeDownloads.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeDownloads.length} activas
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {downloads.map((dl) => (
                <div
                  key={dl.download_id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  {statusIcon(dl.status)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs">{dl.filename}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {dl.device_ip}
                        {dl.file_size > 0 &&
                          ` · ${formatFileSize(dl.file_size)}`}
                      </p>
                      {dl.status === "downloading" && (
                        <Progress value={dl.progress} className="h-1.5 w-24" />
                      )}
                      {dl.status === "failed" && dl.error && (
                        <span className="text-xs text-red-500">{dl.error}</span>
                      )}
                    </div>
                  </div>
                  {dl.status === "completed" && (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`/api/hik-bridge/recordings/${dl.download_id}/file`}
                        download
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Archivo
                      </a>
                    </Button>
                  )}
                  <Badge
                    variant={
                      dl.status === "completed"
                        ? "default"
                        : dl.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {dl.status === "completed"
                      ? "Listo"
                      : dl.status === "downloading"
                        ? `${Math.round(dl.progress)}%`
                        : dl.status === "failed"
                          ? "Error"
                          : "Pendiente"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
