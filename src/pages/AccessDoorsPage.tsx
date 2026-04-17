import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DoorOpen,
  DoorClosed,
  History,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-utils";
import { toast } from "sonner";

interface Door {
  id: string;
  siteId: string | null;
  siteName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  deviceIp: string | null;
  devicePort: number | null;
  hasIntercom: boolean;
  hasIvms: boolean;
  hasHikconnect: boolean;
  lastEventAt: string | null;
}

interface DoorEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export default function AccessDoorsPage() {
  const [doors, setDoors] = useState<Door[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Door | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState(5);
  const [history, setHistory] = useState<DoorEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState<Door | null>(null);

  const loadDoors = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiClient.get<{ success: boolean; data: Door[] }>(
        "/api/access/doors",
      );
      setDoors(resp.data ?? []);
    } catch (err) {
      toast.error(`Failed to load doors: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoors();
  }, [loadDoors]);

  const openDoor = useCallback(
    async (door: Door) => {
      if (!reason || reason.length < 3) {
        toast.error("Motivo es obligatorio (min 3 caracteres)");
        return;
      }
      try {
        const resp = await apiClient.post<{
          success: boolean;
          data: { mode: string; message: string; commandId: string };
        }>("/api/access/doors/open", {
          door_id: door.id,
          reason,
          duration_seconds: duration,
        });
        toast.success(
          `Comando enviado (${resp.data.mode}) — ${resp.data.commandId}`,
        );
        setSelected(null);
        setReason("");
      } catch (err) {
        toast.error(`Failed: ${(err as Error).message}`);
      }
    },
    [reason, duration],
  );

  const loadHistory = useCallback(async (door: Door) => {
    try {
      const resp = await apiClient.get<{ success: boolean; data: DoorEvent[] }>(
        `/api/access/doors/${door.id}/history?limit=50`,
      );
      setHistory(resp.data ?? []);
      setHistoryOpen(door);
    } catch (err) {
      toast.error(`Failed to load history: ${(err as Error).message}`);
    }
  }, []);

  return (
    <PageShell
      title="Control de Acceso — Puertas"
      description="Gestión física de puertas Hikvision vía ISAPI remoto"
      actions={
        <Button
          onClick={loadDoors}
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {doors.length} puertas registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sitio</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Último evento</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doors.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.siteName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {d.deviceName ?? (
                      <Badge variant="outline">Sin device</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.deviceIp ? `${d.deviceIp}:${d.devicePort}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {d.lastEventAt ? formatDateTime(d.lastEventAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setSelected(d)}
                        disabled={!d.deviceIp}
                      >
                        <DoorOpen className="h-4 w-4 mr-1" /> Abrir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadHistory(d)}
                      >
                        <History className="h-4 w-4 mr-1" /> Historial
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abrir {selected?.deviceName}</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará un comando ISAPI al controlador en {selected?.deviceIp}
              :{selected?.devicePort}. Esta acción queda auditada con tu
              usuario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo (obligatorio)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Duración (segundos)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selected && openDoor(selected)}>
              <DoorOpen className="h-4 w-4 mr-2" /> Confirmar apertura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!historyOpen}
        onOpenChange={(o) => !o && setHistoryOpen(null)}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Historial — {historyOpen?.deviceName}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <Badge
                        variant={
                          h.eventType === "door_opened" ? "default" : "outline"
                        }
                      >
                        {h.eventType === "door_opened" && (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {h.eventType === "door_open_failed" && (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {h.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(h.occurredAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {JSON.stringify(h.metadata).slice(0, 80)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
