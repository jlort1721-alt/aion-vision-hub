import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Radar, Router, CheckCircle2, Plus } from "lucide-react";
import { hikBridgeApi } from "@/services/hik-bridge-api";
import type { HikDiscoveredDevice } from "@/services/hik-bridge-api";
import { toast } from "sonner";

export default function NetworkDiscovery() {
  const [timeout, setTimeout_] = useState(10);
  const [results, setResults] = useState<HikDiscoveredDevice[]>([]);

  const scanMutation = useMutation({
    mutationFn: () => hikBridgeApi.scanNetwork(timeout),
    onSuccess: (data) => {
      const devices = data?.data ?? [];
      setResults(devices);
      if (devices.length === 0) {
        toast.info("No se encontraron dispositivos en la red");
      } else {
        const newCount = devices.filter((d) => !d.already_registered).length;
        toast.success(
          `${devices.length} dispositivos encontrados (${newCount} nuevos)`,
        );
      }
    },
    onError: () => toast.error("Error al escanear la red"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="h-5 w-5" />
            Descubrimiento de Red (SADP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Timeout (segundos)</Label>
              <Input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout_(parseInt(e.target.value) || 10)}
                min={3}
                max={60}
                className="h-8 w-24 text-sm"
              />
            </div>
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              size="sm"
            >
              {scanMutation.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Escaneando ({timeout}s)...
                </>
              ) : (
                <>
                  <Radar className="mr-1 h-3 w-3" />
                  Escanear Red
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Router className="h-5 w-5" />
              Dispositivos Encontrados ({results.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((device) => (
                <div
                  key={`${device.ip}-${device.serial_number}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        device.already_registered
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{device.ip}</span>
                        <Badge variant="outline" className="text-xs">
                          {device.device_type || "Desconocido"}
                        </Badge>
                        {device.already_registered && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Registrado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {device.serial_number}
                        {device.firmware_version &&
                          ` · FW: ${device.firmware_version}`}
                        {device.mac_address && ` · MAC: ${device.mac_address}`}
                      </p>
                    </div>
                  </div>
                  {!device.already_registered && (
                    <Button size="sm" variant="outline">
                      <Plus className="mr-1 h-3 w-3" />
                      Agregar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
