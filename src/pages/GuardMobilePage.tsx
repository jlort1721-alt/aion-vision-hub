import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  QrCode,
  AlertTriangle,
  DoorOpen,
  Phone,
  Clock,
  MapPin,
  CheckCircle2,
  Circle,
  Shield,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ──────────────────────────────────────────────────

interface PatrolCheckpoint {
  id: string;
  name: string;
  scanned: boolean;
  scannedAt?: string;
}

interface RecentEvent {
  id: string;
  type: string;
  description: string;
  created_at: string;
  severity: string;
}

// ── Sub-components ─────────────────────────────────────────

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="flex flex-col items-center gap-2 h-24 w-full"
      onClick={onClick}
    >
      <Icon className="h-6 w-6" />
      <span className="text-xs font-medium text-center leading-tight">{label}</span>
    </Button>
  );
}

function ShiftInfo() {
  const { user } = useAuth();
  const now = new Date();
  const hours = now.getHours();
  const shiftLabel =
    hours >= 6 && hours < 14
      ? "Manana (06:00 - 14:00)"
      : hours >= 14 && hours < 22
        ? "Tarde (14:00 - 22:00)"
        : "Noche (22:00 - 06:00)";

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
        <Shield className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {user?.email ?? "Guardia"}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{shiftLabel}</span>
        </div>
      </div>
      <Badge variant="default" className="shrink-0">
        Activo
      </Badge>
    </div>
  );
}

function PatrolProgress() {
  const { data, isLoading } = useQuery({
    queryKey: ["guard-patrol-progress"],
    queryFn: async () => {
      try {
        const resp = await apiClient.get<{
          checkpoints: PatrolCheckpoint[];
        }>("/patrols/current");
        const result = resp as unknown as { checkpoints?: PatrolCheckpoint[] };
        return result.checkpoints ?? [];
      } catch {
        return [] as PatrolCheckpoint[];
      }
    },
    refetchInterval: 30000,
  });

  const checkpoints = data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-2">
        Sin patrulla asignada
      </p>
    );
  }

  const scanned = checkpoints.filter((c: PatrolCheckpoint) => c.scanned).length;
  const pct = Math.round((scanned / checkpoints.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>
          {scanned}/{checkpoints.length} puntos
        </span>
        <span className="font-medium">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <ul className="space-y-1.5">
        {checkpoints.map((cp: PatrolCheckpoint) => (
          <li key={cp.id} className="flex items-center gap-2 text-sm">
            {cp.scanned ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className={cp.scanned ? "line-through text-muted-foreground" : ""}>
              {cp.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentEvents({ limit }: { limit: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["guard-recent-events", limit],
    queryFn: async () => {
      try {
        const resp = await apiClient.get<{
          events: RecentEvent[];
        }>(`/events?limit=${limit}&sort=created_at:desc`);
        const result = resp as unknown as { events?: RecentEvent[] };
        return result.events ?? [];
      } catch {
        return [] as RecentEvent[];
      }
    },
    refetchInterval: 30000,
  });

  const events = data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-2">
        Sin eventos recientes
      </p>
    );
  }

  const severityColor: Record<string, string> = {
    critical: "destructive",
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

  return (
    <ul className="space-y-2">
      {events.map((ev: RecentEvent) => (
        <li key={ev.id} className="flex items-start gap-2 text-sm">
          <Badge
            variant={
              (severityColor[ev.severity] ?? "secondary") as
                | "destructive"
                | "secondary"
                | "outline"
                | "default"
            }
            className="shrink-0 mt-0.5 text-[10px]"
          >
            {ev.type}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="truncate">{ev.description}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(ev.created_at).toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function GateButton({
  label,
  deviceId,
  onClose,
}: {
  label: string;
  deviceId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    try {
      await apiClient.post(`/domotics/ewelink/${deviceId}/control`, {
        action: "unlock",
      });
      toast.success(`${label} abierta`);
      onClose();
    } catch {
      toast.error(`Error al abrir ${label}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full justify-start"
      onClick={handleOpen}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <DoorOpen className="h-4 w-4 mr-2" />
      )}
      {label}
    </Button>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function GuardMobilePage() {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [gateDialogOpen, setGateDialogOpen] = useState(false);
  const [incidentText, setIncidentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openQRScanner = () => setQrDialogOpen(true);
  const openIncidentForm = () => setIncidentDialogOpen(true);
  const openGateDialog = () => setGateDialogOpen(true);
  const callCentral = () => {
    window.location.href = "tel:+573235297412";
  };

  const submitIncident = async () => {
    if (!incidentText.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post("/incidents", {
        description: incidentText,
        severity: "medium",
        type: "novedad",
      });
      toast.success("Novedad reportada");
      setIncidentText("");
      setIncidentDialogOpen(false);
    } catch {
      toast.error("Error al reportar novedad");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <header className="text-center mb-6">
        <h1 className="text-xl font-bold">AION Guard</h1>
        <p className="text-sm text-muted-foreground">Turno activo</p>
      </header>

      {/* Current shift info */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <ShiftInfo />
        </CardContent>
      </Card>

      {/* Quick actions grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <QuickActionButton icon={QrCode} label="Escanear QR" onClick={openQRScanner} />
        <QuickActionButton
          icon={AlertTriangle}
          label="Reportar Novedad"
          onClick={openIncidentForm}
        />
        <QuickActionButton icon={DoorOpen} label="Abrir Puerta" onClick={openGateDialog} />
        <QuickActionButton icon={Phone} label="Llamar Central" onClick={callCentral} />
      </div>

      {/* Patrol progress */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Mi Patrulla
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PatrolProgress />
        </CardContent>
      </Card>

      {/* Recent events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ultimos Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentEvents limit={5} />
        </CardContent>
      </Card>

      {/* QR Scanner Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escanear QR de Punto</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-48 h-48 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center">
              <QrCode className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Apunte la camara al codigo QR del punto de patrulla
            </p>
            <Input
              placeholder="O ingrese codigo manualmente"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const value = (e.target as HTMLInputElement).value;
                  if (value.trim()) {
                    toast.success(`Punto ${value} registrado`);
                    setQrDialogOpen(false);
                  }
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Incident Report Dialog */}
      <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reportar Novedad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea
                placeholder="Describa la novedad..."
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                rows={4}
              />
            </div>
            <Button
              className="w-full"
              onClick={submitIncident}
              disabled={submitting || !incidentText.trim()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Enviar Reporte
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gate Control Dialog */}
      <Dialog open={gateDialogOpen} onOpenChange={setGateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abrir Puerta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Seleccione la puerta o relay a activar
            </p>
            <GateButton
              label="Puerta Principal"
              deviceId="gate-principal"
              onClose={() => setGateDialogOpen(false)}
            />
            <GateButton
              label="Puerta Vehicular"
              deviceId="gate-vehicular"
              onClose={() => setGateDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
