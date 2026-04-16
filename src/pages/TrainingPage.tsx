import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  GraduationCap,
  Plus,
  Award,
  AlertTriangle,
  Users,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle,
  TrendingUp,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  trainingProgramsApi,
  certificationsApi,
  trainingStatsApi,
} from "@/services/training-api";

const certStatusColor: Record<string, string> = {
  enrolled: "secondary",
  in_progress: "default",
  completed: "default",
  failed: "destructive",
  expired: "outline",
};

const categoryLabels: Record<string, string> = {
  safety: "Seguridad Física",
  technology: "Tecnología",
  compliance: "Cumplimiento",
  first_aid: "Primeros Auxilios",
  emergency: "Emergencias",
  firearms: "Armas de Fuego",
  customer_service: "Servicio al Cliente",
  security: "Seguridad",
  leadership: "Liderazgo",
  platform: "Plataforma",
  technical: "Técnico",
  other: "Otros",
};

const defaultProgramForm = {
  name: "",
  description: "",
  category: "security" as string,
  durationHours: 8,
  isRequired: false,
  validityMonths: 12,
  passingScore: 70,
  isActive: true,
};

const defaultEnrollForm = {
  programId: "",
  userId: "",
  userName: "",
};

const defaultCompleteForm = {
  score: 0,
  notes: "",
};

export default function TrainingPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  // UI state
  const [tab, setTab] = useState("programs");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [certStatusFilter, setCertStatusFilter] = useState("all");

  // Dialogs
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completingCert, setCompletingCert] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Forms
  const [progForm, setProgForm] = useState({ ...defaultProgramForm });
  const [enrollForm, setEnrollForm] = useState({ ...defaultEnrollForm });
  const [completeForm, setCompleteForm] = useState({ ...defaultCompleteForm });

  // Queries
  const {
    data: programs,
    isLoading: loadingPrograms,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["training-programs", categoryFilter],
    queryFn: () =>
      trainingProgramsApi.list({
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      }),
  });

  const { data: certs, isLoading: loadingCerts } = useQuery({
    queryKey: ["certifications", certStatusFilter],
    queryFn: () =>
      certificationsApi.list({
        ...(certStatusFilter !== "all" && { status: certStatusFilter }),
      }),
  });

  const { data: expiring } = useQuery({
    queryKey: ["expiring-certs"],
    queryFn: () => certificationsApi.getExpiring(30),
  });

  const { data: stats } = useQuery({
    queryKey: ["training-stats"],
    queryFn: () => trainingStatsApi.get(),
  });

  // Mutations
  const createProgram = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      trainingProgramsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      closeProgramDialog();
      toast.success("Programa creado exitosamente");
    },
    onError: (err: Error) =>
      toast.error(`Error al crear programa: ${err.message}`),
  });

  const updateProgram = useMutation({
    mutationFn: ({ id, ...data }: any) => trainingProgramsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      closeProgramDialog();
      toast.success("Programa actualizado");
    },
    onError: (err: Error) =>
      toast.error(`Error al actualizar programa: ${err.message}`),
  });

  const deleteProgram = useMutation({
    mutationFn: (id: string) => trainingProgramsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      setDeleteTarget(null);
      toast.success("Programa eliminado");
    },
    onError: (err: Error) =>
      toast.error(`Error al eliminar programa: ${err.message}`),
  });

  const enrollUser = useMutation({
    mutationFn: (data: {
      programId: string;
      userId: string;
      userName: string;
    }) => certificationsApi.enroll(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certifications"] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      closeEnrollDialog();
      toast.success("Usuario inscrito exitosamente");
    },
    onError: (err: Error) =>
      toast.error(`Error al inscribir usuario: ${err.message}`),
  });

  const completeCert = useMutation({
    mutationFn: ({
      id,
      score,
      notes,
    }: {
      id: string;
      score: number;
      notes?: string;
    }) => certificationsApi.complete(id, { score, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certifications"] });
      qc.invalidateQueries({ queryKey: ["training-stats"] });
      qc.invalidateQueries({ queryKey: ["expiring-certs"] });
      closeCompleteDialog();
      toast.success("Certificación completada");
    },
    onError: (err: Error) =>
      toast.error(`Error al completar certificación: ${err.message}`),
  });

  // Dialog helpers
  const openCreateProgram = () => {
    setEditingProgram(null);
    setProgForm({ ...defaultProgramForm });
    setShowProgramDialog(true);
  };

  const openEditProgram = (p: any) => {
    setEditingProgram(p);
    setProgForm({
      name: p.name || "",
      description: p.description || "",
      category: p.category || "security",
      durationHours: p.durationHours || 8,
      isRequired: p.isRequired ?? false,
      validityMonths: p.validityMonths || 12,
      passingScore: p.passingScore || 70,
      isActive: p.isActive ?? true,
    });
    setShowProgramDialog(true);
  };

  const closeProgramDialog = () => {
    setShowProgramDialog(false);
    setEditingProgram(null);
    setProgForm({ ...defaultProgramForm });
  };

  const openEnrollDialog = () => {
    setEnrollForm({ ...defaultEnrollForm });
    setShowEnrollDialog(true);
  };

  const closeEnrollDialog = () => {
    setShowEnrollDialog(false);
    setEnrollForm({ ...defaultEnrollForm });
  };

  const openCompleteDialog = (cert: any) => {
    setCompletingCert(cert);
    setCompleteForm({ score: 0, notes: "" });
    setShowCompleteDialog(true);
  };

  const closeCompleteDialog = () => {
    setShowCompleteDialog(false);
    setCompletingCert(null);
    setCompleteForm({ ...defaultCompleteForm });
  };

  const handleProgramSubmit = () => {
    if (editingProgram) {
      updateProgram.mutate({ id: editingProgram.id, ...progForm });
    } else {
      createProgram.mutate(progForm);
    }
  };

  // Filtering
  const filteredPrograms = (programs?.data || []).filter((p: any) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const filteredCerts = (certs?.data || []).filter((c: any) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        c.userName?.toLowerCase().includes(s) ||
        c.programName?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const s = stats?.data;
  const expiringCount = expiring?.data?.length ?? 0;

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Capacitación y Certificaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestione programas de capacitación, inscripciones y certificaciones
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalPrograms ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Programas de capacitación
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />
              Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {s?.totalCertifications ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total emitidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Tasa de Cumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(s?.complianceRate ?? 0) >= 80 ? "text-success" : (s?.complianceRate ?? 0) >= 50 ? "text-warning" : "text-destructive"}`}
            >
              {s?.complianceRate ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tasa de completitud
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Por Vencer (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {expiringCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Necesitan renovación
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Certificaciones por Vencer Warning */}
      {expiringCount > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Certificaciones por Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(expiring?.data || []).slice(0, 5).map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-medium">{c.userName}</span>
                    {c.programName && (
                      <span className="text-muted-foreground ml-2">
                        - {c.programName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-warning" />
                    <span className="text-xs text-muted-foreground">
                      Vence: {new Date(c.expiresAt).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                </div>
              ))}
              {expiringCount > 5 && (
                <p className="text-xs text-muted-foreground mt-1">... y más</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="programs">
              <GraduationCap className="h-4 w-4 mr-1" />
              Programs
            </TabsTrigger>
            <TabsTrigger value="certifications">
              <Award className="h-4 w-4 mr-1" />
              Certifications
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === "programs" && (
              <Button size="sm" onClick={openCreateProgram}>
                <Plus className="h-4 w-4 mr-1" />
                Nuevo Programa
              </Button>
            )}
            {tab === "certifications" && (
              <Button size="sm" onClick={openEnrollDialog}>
                <Users className="h-4 w-4 mr-1" />
                Inscribir Usuario
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={
                tab === "programs"
                  ? "Buscar programas..."
                  : "Buscar certificaciones..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          {tab === "programs" && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Categorías</SelectItem>
                <SelectItem value="safety">Seguridad</SelectItem>
                <SelectItem value="technology">Tecnología</SelectItem>
                <SelectItem value="compliance">Cumplimiento</SelectItem>
                <SelectItem value="first_aid">Primeros Auxilios</SelectItem>
                <SelectItem value="emergency">Emergencia</SelectItem>
                <SelectItem value="firearms">Armas de Fuego</SelectItem>
                <SelectItem value="customer_service">
                  Atención al Cliente
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          {tab === "certifications" && (
            <Select
              value={certStatusFilter}
              onValueChange={setCertStatusFilter}
            >
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo Estado</SelectItem>
                <SelectItem value="enrolled">Inscrito</SelectItem>
                <SelectItem value="in_progress">En Progreso</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="failed">Fallido</SelectItem>
                <SelectItem value="expired">Vencido</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Programs Tab */}
        <TabsContent value="programs">
          <Card>
            <CardContent className="p-0">
              {loadingPrograms ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredPrograms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(programs?.data || []).length === 0
                      ? "Sin programas de capacitación"
                      : "Sin programas que coincidan con los filtros"}
                  </p>
                  {(programs?.data || []).length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={openCreateProgram}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Crear primer programa
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Name</th>
                      <th className="p-3 text-left font-medium">Categoría</th>
                      <th className="p-3 text-left font-medium">Duration</th>
                      <th className="p-3 text-left font-medium">Nota Mín.</th>
                      <th className="p-3 text-left font-medium">Vigencia</th>
                      <th className="p-3 text-left font-medium">Obligatorio</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 w-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrograms.map((p: any) => (
                      <tr
                        key={p.id}
                        className="border-b hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3">
                          <div className="font-medium">{p.name}</div>
                          {p.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {p.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">
                            {categoryLabels[p.category] || p.category}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="font-mono font-bold">
                            {p.durationHours}
                          </span>
                          h
                        </td>
                        <td className="p-3 text-xs">
                          <span className="font-mono">{p.passingScore}%</span>
                        </td>
                        <td className="p-3 text-xs">
                          {p.validityMonths} meses
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={p.isRequired ? "destructive" : "secondary"}
                          >
                            {p.isRequired ? "Required" : "Optional"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={p.isActive ? "default" : "secondary"}>
                            {p.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEditProgram(p)}
                              >
                                <Pencil className="mr-2 h-3 w-3" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEnrollForm({
                                    ...defaultEnrollForm,
                                    programId: p.id,
                                  });
                                  setShowEnrollDialog(true);
                                }}
                              >
                                <Users className="mr-2 h-3 w-3" />
                                Inscribir Usuario
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(p)}
                              >
                                <Trash2 className="mr-2 h-3 w-3" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-muted-foreground mt-2">
            {filteredPrograms.length} programa(s) mostrados
          </div>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications">
          <Card>
            <CardContent className="p-0">
              {loadingCerts ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredCerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Award className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(certs?.data || []).length === 0
                      ? "Sin certificaciones aún"
                      : "Sin certificaciones que coincidan con los filtros"}
                  </p>
                  {(certs?.data || []).length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={openEnrollDialog}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Inscribir primer usuario
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">User</th>
                      <th className="p-3 text-left font-medium">Program</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Score</th>
                      <th className="p-3 text-left font-medium">Inscrito</th>
                      <th className="p-3 text-left font-medium">Completado</th>
                      <th className="p-3 text-left font-medium">Expires</th>
                      <th className="p-3 w-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCerts.map((c: any) => {
                      const isExpiringSoon =
                        c.expiresAt &&
                        new Date(c.expiresAt) <=
                          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                        new Date(c.expiresAt) > new Date();
                      const isExpired =
                        c.expiresAt && new Date(c.expiresAt) <= new Date();

                      return (
                        <tr
                          key={c.id}
                          className="border-b hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3 font-medium">{c.userName}</td>
                          <td className="p-3 text-xs">
                            {c.programName || "-"}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                certStatusColor[c.status] as
                                  | "default"
                                  | "secondary"
                                  | "destructive"
                                  | "outline"
                              }
                              className="capitalize"
                            >
                              {c.status?.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs">
                            {c.score != null ? (
                              <span
                                className={`font-mono font-bold ${c.score >= (c.passingScore || 70) ? "text-success" : "text-destructive"}`}
                              >
                                {c.score}%
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            {c.enrolledAt
                              ? new Date(c.enrolledAt).toLocaleDateString(
                                  "es-CO",
                                )
                              : c.createdAt
                                ? new Date(c.createdAt).toLocaleDateString(
                                    "es-CO",
                                  )
                                : "-"}
                          </td>
                          <td className="p-3 text-xs">
                            {c.completedAt
                              ? new Date(c.completedAt).toLocaleDateString(
                                  "es-CO",
                                )
                              : "-"}
                          </td>
                          <td className="p-3 text-xs">
                            {c.expiresAt ? (
                              <span
                                className={
                                  isExpired
                                    ? "text-destructive font-bold"
                                    : isExpiringSoon
                                      ? "text-warning font-medium"
                                      : ""
                                }
                              >
                                {new Date(c.expiresAt).toLocaleDateString(
                                  "es-CO",
                                )}
                                {isExpired && " (Vencido)"}
                                {isExpiringSoon && !isExpired && " (Pronto)"}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-3">
                            {(c.status === "enrolled" ||
                              c.status === "in_progress") && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openCompleteDialog(c)}
                                  >
                                    <CheckCircle className="mr-2 h-3 w-3" />
                                    Complete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-muted-foreground mt-2">
            {filteredCerts.length} certificación(es) mostradas
          </div>
        </TabsContent>
      </Tabs>

      {/* Program Create/Edit Dialog */}
      <Dialog
        open={showProgramDialog}
        onOpenChange={(o) => {
          if (!o) closeProgramDialog();
          else setShowProgramDialog(true);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProgram
                ? "Editar Programa"
                : "Nuevo Programa de Capacitación"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Nombre del Programa *</Label>
              <Input
                value={progForm.name}
                onChange={(e) =>
                  setProgForm({ ...progForm, name: e.target.value })
                }
                placeholder="Nombre del programa"
              />
            </div>

            <div className="space-y-1">
              <Label>Descripción</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={progForm.description}
                onChange={(e) =>
                  setProgForm({ ...progForm, description: e.target.value })
                }
                placeholder="Descripción del programa..."
              />
            </div>

            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select
                value={progForm.category}
                onValueChange={(v) => setProgForm({ ...progForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safety">Seguridad</SelectItem>
                  <SelectItem value="technology">Tecnología</SelectItem>
                  <SelectItem value="compliance">Cumplimiento</SelectItem>
                  <SelectItem value="first_aid">Primeros Auxilios</SelectItem>
                  <SelectItem value="emergency">Emergencia</SelectItem>
                  <SelectItem value="firearms">Armas de Fuego</SelectItem>
                  <SelectItem value="customer_service">
                    Atención al Cliente
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Duración (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  value={progForm.durationHours}
                  onChange={(e) =>
                    setProgForm({
                      ...progForm,
                      durationHours: parseInt(e.target.value) || 8,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Nota de Aprobación (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={progForm.passingScore}
                  onChange={(e) =>
                    setProgForm({
                      ...progForm,
                      passingScore: parseInt(e.target.value) || 70,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Vigencia (months)</Label>
                <Input
                  type="number"
                  min={0}
                  value={progForm.validityMonths}
                  onChange={(e) =>
                    setProgForm({
                      ...progForm,
                      validityMonths: parseInt(e.target.value) || 12,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={progForm.isRequired}
                  onCheckedChange={(v) =>
                    setProgForm({ ...progForm, isRequired: v })
                  }
                />
                <Label>Capacitación Obligatoria</Label>
              </div>
              {editingProgram && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={progForm.isActive}
                    onCheckedChange={(v) =>
                      setProgForm({ ...progForm, isActive: v })
                    }
                  />
                  <Label>Activo</Label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeProgramDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleProgramSubmit}
              disabled={
                !progForm.name ||
                createProgram.isPending ||
                updateProgram.isPending
              }
            >
              {createProgram.isPending || updateProgram.isPending
                ? "Guardando..."
                : editingProgram
                  ? "Actualizar Programa"
                  : "Crear Programa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inscribir Usuario Dialog */}
      <Dialog
        open={showEnrollDialog}
        onOpenChange={(o) => {
          if (!o) closeEnrollDialog();
          else setShowEnrollDialog(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inscribir Usuario in Training Program</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Seleccionar Programa *</Label>
              <Select
                value={enrollForm.programId}
                onValueChange={(v) =>
                  setEnrollForm({ ...enrollForm, programId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar programa..." />
                </SelectTrigger>
                <SelectContent>
                  {(programs?.data || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.isRequired && " (Obligatorio)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>ID de Usuario *</Label>
              <Input
                value={enrollForm.userId}
                onChange={(e) =>
                  setEnrollForm({ ...enrollForm, userId: e.target.value })
                }
                placeholder="UUID del usuario"
              />
            </div>
            <div className="space-y-1">
              <Label>Nombre del Usuario *</Label>
              <Input
                value={enrollForm.userName}
                onChange={(e) =>
                  setEnrollForm({ ...enrollForm, userName: e.target.value })
                }
                placeholder="Nombre completo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEnrollDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                enrollUser.mutate({
                  programId: enrollForm.programId,
                  userId: enrollForm.userId,
                  userName: enrollForm.userName,
                })
              }
              disabled={
                !enrollForm.programId ||
                !enrollForm.userId ||
                !enrollForm.userName ||
                enrollUser.isPending
              }
            >
              {enrollUser.isPending ? "Inscribiendo..." : "Inscribir Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completar Certificación Dialog */}
      <Dialog
        open={showCompleteDialog}
        onOpenChange={(o) => {
          if (!o) closeCompleteDialog();
          else setShowCompleteDialog(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar Certificación</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {completingCert && (
              <div className="p-3 rounded-md bg-muted/50 text-sm">
                <div className="font-medium">{completingCert.userName}</div>
                {completingCert.programName && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Program: {completingCert.programName}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label>Puntaje (0-100) *</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={completeForm.score}
                onChange={(e) =>
                  setCompleteForm({
                    ...completeForm,
                    score: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="Ingrese puntaje"
              />
              {completingCert?.passingScore && (
                <p className="text-xs text-muted-foreground">
                  Nota de aprobación: {completingCert.passingScore}%
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <textarea
                className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={completeForm.notes}
                onChange={(e) =>
                  setCompleteForm({ ...completeForm, notes: e.target.value })
                }
                placeholder="Notas de evaluación..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCompleteDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                completeCert.mutate({
                  id: completingCert.id,
                  score: completeForm.score,
                  notes: completeForm.notes || undefined,
                })
              }
              disabled={completeCert.isPending}
            >
              {completeCert.isPending
                ? "Completando..."
                : "Completar Certificación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Program Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Programa</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar el programa "{deleteTarget?.name}"? Esto
              no eliminará certificaciones existentes pero no se podrán hacer
              nuevas inscripciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteProgram.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
