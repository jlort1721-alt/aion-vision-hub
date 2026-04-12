import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Bell,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import { hikBridgeApi } from "@/services/hik-bridge-api";
import type { HikDeviceStatus } from "@/services/hik-bridge-api";
import { toast } from "sonner";

export default function HikBridgeStatus() {
  const queryClient = useQueryClient();

  const {
    data: statusData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["hik-bridge", "status"],
    queryFn: () => hikBridgeApi.getStatus(),
    refetchInterval: 30_000,
  });

  const { data: devicesData } = useQuery({
    queryKey: ["hik-bridge", "devices"],
    queryFn: () => hikBridgeApi.listDevices(),
    refetchInterval: 30_000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => hikBridgeApi.refreshDevices(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hik-bridge"] });
      toast.success("Dispositivos actualizados");
    },
    onError: () => toast.error("Error al refrescar dispositivos"),
  });

  const health = statusData?.data;
  const devices: HikDeviceStatus[] = devicesData?.data ?? [];
  const onlineDevices = devices.filter((d) => d.online);
  const offlineDevices = devices.filter((d) => !d.online);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Hikvision SDK Bridge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-52" />
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            Hikvision SDK Bridge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="h-4 w-4" />
            Bridge no disponible
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            El microservicio hik-bridge no esta corriendo en puerto 8100
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-5 w-5" />
          Hikvision SDK Bridge
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={health.status === "ok" ? "default" : "secondary"}>
            {health.status === "ok" ? "Activo" : "Degradado"}
          </Badge>
          <Badge variant={health.sdk_initialized ? "default" : "outline"}>
            SDK: {health.sdk_initialized ? "OK" : "Mock"}
          </Badge>
          {health.sdk_version && (
            <Badge variant="outline">v{health.sdk_version}</Badge>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center rounded-md border p-2">
            <Wifi className="mb-1 h-4 w-4 text-green-500" />
            <span className="text-lg font-bold">{onlineDevices.length}</span>
            <span className="text-xs text-muted-foreground">Conectados</span>
          </div>
          <div className="flex flex-col items-center rounded-md border p-2">
            <WifiOff className="mb-1 h-4 w-4 text-red-500" />
            <span className="text-lg font-bold">{offlineDevices.length}</span>
            <span className="text-xs text-muted-foreground">Desconectados</span>
          </div>
          <div className="flex flex-col items-center rounded-md border p-2">
            <Bell className="mb-1 h-4 w-4 text-yellow-500" />
            <span className="text-lg font-bold">
              {health.alarm_subscriptions}
            </span>
            <span className="text-xs text-muted-foreground">Alarmas</span>
          </div>
        </div>

        {/* Device list */}
        {devices.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Dispositivos ({devices.length})
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {devices.map((device) => (
                <div
                  key={device.ip}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        device.online ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="font-mono text-xs">{device.ip}</span>
                    {device.name && (
                      <span className="text-muted-foreground">
                        {device.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {device.channel_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {device.channel_count}ch
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
