import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  AlertTriangle,
  Users,
  Clock,
  Activity,
  TrendingUp,
  Bell,
  Loader2,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface DashboardStats {
  events24h: number;
  activeIncidents: number;
  devicesOnline: number;
  devicesTotal: number;
  slaCompliance: number;
}

interface FiringAlert {
  id: string;
  ruleName: string;
  severity: string;
  firedAt: string;
  message: string;
}

interface ShiftAssignment {
  id: string;
  operatorName: string;
  role: string;
  shiftName: string;
  isOnline: boolean;
}

interface OpenIncident {
  id: string;
  title: string;
  priority: string;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  info: "bg-gray-500",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Cr\u00edtico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
  info: "Info",
};

export default function SupervisorPanelPage() {
  const [shiftNotes, setShiftNotes] = useState("");

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => apiClient.get("/analytics/dashboard"),
    refetchInterval: 30_000,
  });

  const { data: alerts = [] } = useQuery<FiringAlert[]>({
    queryKey: ["alerts", "firing"],
    queryFn: () => apiClient.get("/alerts/instances", { status: "firing" }),
    refetchInterval: 30_000,
  });

  const { data: incidents = [] } = useQuery<OpenIncident[]>({
    queryKey: ["incidents", "open"],
    queryFn: () => apiClient.get("/incidents", { status: "open" }),
  });

  const { data: assignments = [] } = useQuery<ShiftAssignment[]>({
    queryKey: ["shifts", "assignments"],
    queryFn: () => apiClient.get("/shifts/assignments"),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      apiClient.post("/shifts/current/report", { notes: shiftNotes }),
    onSuccess: () => {
      toast.success("Reporte de turno generado correctamente");
    },
    onError: () => {
      toast.error("Error al generar el reporte");
    },
  });

  const handleSign = () => {
    toast.success("Turno firmado y cerrado correctamente");
  };

  const kpis = [
    {
      label: "Eventos (24h)",
      value: stats?.events24h ?? "--",
      icon: Activity,
      color: "text-blue-500",
    },
    {
      label: "Incidentes activos",
      value: stats?.activeIncidents ?? "--",
      icon: AlertTriangle,
      color: "text-orange-500",
    },
    {
      label: "Dispositivos en l\u00ednea",
      value: stats ? `${stats.devicesOnline}/${stats.devicesTotal}` : "--",
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      label: "Cumplimiento SLA",
      value: stats ? `${stats.slaCompliance}%` : "--",
      icon: Shield,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Panel del Supervisor</h1>
        <Badge variant="outline" className="ml-auto">
          <Clock className="mr-1 h-3 w-3" />
          Actualizado cada 30s
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: KPIs */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            KPIs en Tiempo Real
          </h2>
          {kpis.map((kpi) => {
            const IconComp = kpi.icon;
            return (
              <Card key={kpi.label}>
                <CardContent className="flex items-center gap-4 p-4">
                  <IconComp className={`h-8 w-8 ${kpi.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Center: Alerts & Escalations */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Alertas y Escalamientos
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto divide-y">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mb-2" />
                    <p className="text-sm">Sin alertas activas</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-4">
                      <Bell className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${SEVERITY_COLORS[alert.severity] ?? "bg-gray-500"} text-white text-xs`}
                          >
                            {SEVERITY_LABELS[alert.severity] ?? alert.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.firedAt).toLocaleString("es-CO")}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">
                          {alert.ruleName}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {alert.message}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        Atender
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {incidents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Incidentes Abiertos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {incidents.slice(0, 5).map((inc) => (
                    <li
                      key={inc.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate">{inc.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {inc.priority}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Operators on shift */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Operadores en Turno
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {assignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mb-2" />
                    <p className="text-sm">Sin asignaciones de turno</p>
                  </div>
                ) : (
                  assignments.map((op) => (
                    <div key={op.id} className="flex items-center gap-3 p-4">
                      <span
                        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                          op.isOnline ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {op.operatorName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {op.role} &middot; {op.shiftName}
                        </p>
                      </div>
                      <Badge
                        variant={op.isOnline ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {op.isOnline ? "En l\u00ednea" : "Desconectado"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom: Shift handover */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Entrega de Turno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Operador: Usuario actual</span>
            <span>&middot;</span>
            <span>{new Date().toLocaleString("es-CO")}</span>
          </div>
          <Textarea
            placeholder="Notas de entrega de turno..."
            value={shiftNotes}
            onChange={(e) => setShiftNotes(e.target.value)}
            rows={4}
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}
            >
              {reportMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <FileText className="mr-2 h-4 w-4" />
              Generar Reporte
            </Button>
            <Button onClick={handleSign}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Firmar y Cerrar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
