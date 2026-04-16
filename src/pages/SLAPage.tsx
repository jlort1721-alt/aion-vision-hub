import { useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { slaDefinitionsApi, slaTrackingApi } from "@/services/sla-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import {
  Timer,
  CheckCircle,
  AlertTriangle,
  Target,
  Plus,
  Filter,
  Loader2,
} from "lucide-react";

const severityColors: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-warning",
  low: "bg-primary",
};

const severityLabels: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Info",
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getDeadlineInfo(deadline: string): {
  text: string;
  isUrgent: boolean;
  isBreached: boolean;
} {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 0) {
    return {
      text: `Incumplido hace ${Math.abs(diffMins)}m`,
      isUrgent: true,
      isBreached: true,
    };
  }
  if (diffMins < 30) {
    return {
      text: `${diffMins}m restantes`,
      isUrgent: true,
      isBreached: false,
    };
  }
  return {
    text: formatMinutes(diffMins) + " restantes",
    isUrgent: false,
    isBreached: false,
  };
}

export default function SLAPage() {
  const [activeTab, setActiveTab] = useState("definitions");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Definitions ─────────────────────────────────────────
  const {
    data: definitionsData,
    isLoading: loadingDefinitions,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sla", "definitions"],
    queryFn: () => slaDefinitionsApi.list(),
  });

  const createDefinitionMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      slaDefinitionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla", "definitions"] });
      setCreateOpen(false);
      toast({ title: "Definición SLA creada" });
    },
    onError: () => {
      toast({ title: "Error al crear definición", variant: "destructive" });
    },
  });

  const deleteDefinitionMutation = useMutation({
    mutationFn: (id: string) => slaDefinitionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla", "definitions"] });
      setDeleteTarget(null);
      toast({ title: "Definición SLA eliminada" });
    },
  });

  // ── Tracking ────────────────────────────────────────────
  const { data: trackingData, isLoading: loadingTracking } = useQuery({
    queryKey: ["sla", "tracking"],
    queryFn: () => slaTrackingApi.list(),
    refetchInterval: 15000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["sla", "stats"],
    queryFn: () => slaTrackingApi.stats(),
    refetchInterval: 30000,
  });

  const allDefinitions: any[] = definitionsData?.data ?? [];
  const definitions =
    severityFilter === "all"
      ? allDefinitions
      : allDefinitions.filter((d: any) => d.severity === severityFilter);
  const tracking: any[] = trackingData?.data ?? [];
  const stats = statsData?.data as Record<string, unknown> | undefined;

  const breachedCount = tracking.filter(
    (t: any) => t.deadline && getDeadlineInfo(t.deadline).isBreached,
  ).length;
  const activeTrackingCount = tracking.filter(
    (t: any) => t.status !== "resolved",
  ).length;

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6" />
            Gestión de SLA
          </h1>
          <p className="text-muted-foreground">
            Defina acuerdos de nivel de servicio y monitoree el cumplimiento
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all"
          onClick={() => setActiveTab("definitions")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SLAs Activos</p>
                <p className="text-3xl font-bold">
                  {stats?.activeSlas ?? allDefinitions.length}
                </p>
              </div>
              <Timer className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cumplidos</p>
                <p className="text-3xl font-bold text-success">
                  {stats?.met ?? 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:ring-1 hover:ring-destructive/50 transition-all"
          onClick={() => setActiveTab("tracking")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incumplidos</p>
                <p className="text-3xl font-bold text-destructive">
                  {stats?.breached ?? breachedCount}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Tasa de Incumplimiento
                </p>
                <p className="text-3xl font-bold text-warning">
                  {stats?.responseBreachRate ?? 0}%
                </p>
              </div>
              <Target className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs with counts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="definitions" className="gap-1">
            <Target className="h-4 w-4" /> Definiciones
            {allDefinitions.length > 0 && (
              <Badge variant="outline" className="ml-1 h-5 text-[10px]">
                {allDefinitions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1">
            <Timer className="h-4 w-4" /> Seguimiento
            {activeTrackingCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 text-[10px]">
                {activeTrackingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Definitions Tab ─────────────────────────────── */}
        <TabsContent value="definitions" className="space-y-4">
          <div className="flex items-center justify-between">
            {/* Severity filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {["all", "critical", "high", "medium", "low"].map((sev) => (
                <Button
                  key={sev}
                  variant={severityFilter === sev ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev === "all" ? "Todas" : severityLabels[sev] || sev}
                </Button>
              ))}
            </div>
            <Button className="gap-1" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Nueva Definición
            </Button>
          </div>
          {loadingDefinitions ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : definitions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Sin definiciones SLA</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cree su primera definición SLA para comenzar el seguimiento
                </p>
              </CardContent>
            </Card>
          ) : (
            definitions.map((def: any) => (
              <Card key={def.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{def.name}</h3>
                          <Badge
                            className={
                              severityColors[def.severity] || "bg-gray-500"
                            }
                          >
                            {severityLabels[def.severity] || def.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Tiempo de Respuesta:{" "}
                          {formatMinutes(def.responseTimeMinutes ?? 0)} | Tiempo
                          de Resolución:{" "}
                          {formatMinutes(def.resolutionTimeMinutes ?? 0)}
                        </p>
                        {def.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {def.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive/70"
                      onClick={() => setDeleteTarget(def)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Tracking Tab ────────────────────────────────── */}
        <TabsContent value="tracking" className="space-y-4">
          {loadingTracking ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tracking.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Timer className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">
                  Sin elementos de seguimiento activos
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  El seguimiento SLA aparecerá aquí cuando los incidentes se
                  vinculen a definiciones SLA
                </p>
              </CardContent>
            </Card>
          ) : (
            tracking.map((item: any) => {
              const deadlineInfo = item.deadline
                ? getDeadlineInfo(item.deadline)
                : null;
              return (
                <Card
                  key={item.id}
                  className={
                    deadlineInfo?.isBreached ? "border-destructive/50" : ""
                  }
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Timer
                          className={`h-5 w-5 mt-0.5 ${deadlineInfo?.isBreached ? "text-destructive" : deadlineInfo?.isUrgent ? "text-warning animate-pulse" : "text-muted-foreground"}`}
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">
                              {item.title ||
                                item.incidentTitle ||
                                "Elemento SLA"}
                            </h3>
                            <Badge
                              className={
                                severityColors[item.severity] || "bg-gray-500"
                              }
                            >
                              {severityLabels[item.severity] || item.severity}
                            </Badge>
                            {deadlineInfo?.isBreached && (
                              <Badge variant="destructive">Incumplido</Badge>
                            )}
                            {item.status && (
                              <Badge variant="outline">
                                {item.status === "resolved"
                                  ? "Resuelto"
                                  : item.status === "in_progress"
                                    ? "En curso"
                                    : item.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            SLA: {item.slaName || "Desconocido"} | Creado:{" "}
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString("es-CO")
                              : "N/A"}
                          </p>
                          {deadlineInfo && (
                            <p
                              className={`text-sm mt-1 font-medium ${deadlineInfo.isBreached ? "text-destructive" : deadlineInfo.isUrgent ? "text-warning" : "text-success"}`}
                            >
                              {deadlineInfo.text}
                            </p>
                          )}
                        </div>
                      </div>
                      {!deadlineInfo?.isBreached &&
                        item.status !== "resolved" && (
                          <Badge variant="outline" className="shrink-0">
                            <Timer className="h-3 w-3 mr-1" />
                            Activo
                          </Badge>
                        )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Definición SLA</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar <strong>"{deleteTarget?.name}"</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteDefinitionMutation.mutate(deleteTarget.id)
              }
            >
              {deleteDefinitionMutation.isPending
                ? "Eliminando..."
                : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create SLA Definition Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Nueva Definición SLA</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createDefinitionMutation.mutate({
                  name: fd.get("name"),
                  description: fd.get("description"),
                  severity: fd.get("severity"),
                  response_time_minutes: Number(fd.get("response_time")),
                  resolution_time_minutes: Number(fd.get("resolution_time")),
                  business_hours_only: fd.get("business_hours") === "on",
                  is_active: true,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  name="name"
                  required
                  className="w-full border rounded-md p-2 text-sm bg-background"
                  placeholder="Ej: SLA Crítico"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  className="w-full border rounded-md p-2 text-sm bg-background min-h-[60px]"
                  placeholder="Descripción del nivel de servicio"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Severidad
                  </label>
                  <select
                    name="severity"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-background"
                  >
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mt-6">
                    <input
                      type="checkbox"
                      name="business_hours"
                      className="rounded"
                    />
                    Solo horario laboral
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tiempo respuesta (min)
                  </label>
                  <input
                    name="response_time"
                    type="number"
                    min="1"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-background"
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tiempo resolución (min)
                  </label>
                  <input
                    name="resolution_time"
                    type="number"
                    min="1"
                    required
                    className="w-full border rounded-md p-2 text-sm bg-background"
                    placeholder="30"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createDefinitionMutation.isPending}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {createDefinitionMutation.isPending
                    ? "Creando..."
                    : "Crear Definición"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
