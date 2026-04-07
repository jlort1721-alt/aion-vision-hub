import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ErrorState from "@/components/ui/ErrorState";
import { scheduledReportsApi } from "@/services/scheduled-reports-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileBarChart, Calendar, Clock, PauseCircle, Plus, Pencil, Trash2, Play, Pause } from "lucide-react";

// ── Constants ────────────────────────────────────────────────

const REPORT_TYPES = [
  { value: "events", label: "Eventos" },
  { value: "incidents", label: "Incidentes" },
  { value: "devices", label: "Dispositivos" },
  { value: "access", label: "Accesos" },
  { value: "shifts", label: "Turnos" },
] as const;

const SCHEDULE_FREQUENCIES = [
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
] as const;

const WEEKDAYS = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
] as const;

const FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
] as const;

const reportTypeBadgeColors: Record<string, string> = {
  events: "bg-primary hover:bg-primary/90",
  incidents: "bg-destructive hover:bg-destructive/90",
  devices: "bg-warning hover:bg-warning/90",
  access: "bg-success hover:bg-success/90",
  shifts: "bg-purple-500 hover:bg-purple-600",
};

const typeLabels: Record<string, string> = {
  events: "Eventos", incidents: "Incidentes", devices: "Dispositivos", access: "Accesos", shifts: "Turnos",
};

// ── Types ────────────────────────────────────────────────────

interface ScheduledReport {
  id: string; name: string; type: string; frequency: string; time: string;
  dayOfWeek?: string; dayOfMonth?: number; recipients: string[];
  format: string; isActive: boolean; lastRunAt?: string; nextRunAt?: string;
}

interface FormState {
  name: string; type: string; frequency: string; time: string;
  dayOfWeek: string; dayOfMonth: string; recipients: string;
  format: string; isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "", type: "events", frequency: "daily", time: "08:00",
  dayOfWeek: "monday", dayOfMonth: "1", recipients: "", format: "pdf", isActive: true,
};

// ── Helpers ──────────────────────────────────────────────────

const dayLabels: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves",
  friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

function formatSchedule(report: ScheduledReport): string {
  const time = report.time || "00:00";
  switch (report.frequency) {
    case "daily": return `Diario a las ${time}`;
    case "weekly": return `Semanal los ${dayLabels[report.dayOfWeek || 'monday'] || report.dayOfWeek} a las ${time}`;
    case "monthly": return `Mensual el día ${report.dayOfMonth ?? 1} a las ${time}`;
    default: return report.frequency || "Sin definir";
  }
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString('es-CO');
}

function getMostRecentRun(reports: ScheduledReport[]): string {
  const timestamps = reports.map(r => r.lastRunAt).filter(Boolean).map(t => new Date(t!).getTime());
  if (timestamps.length === 0) return "Sin ejecuciones";
  return new Date(Math.max(...timestamps)).toLocaleString('es-CO');
}

// ── Component ────────────────────────────────────────────────

export default function ScheduledReportsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledReport | null>(null);

  const { data: reportsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: () => scheduledReportsApi.list(),
  });

  const reports: ScheduledReport[] = (reportsData?.data ?? []) as unknown as ScheduledReport[];
  const activeCount = reports.filter(r => r.isActive).length;
  const pausedCount = reports.filter(r => !r.isActive).length;

  // ── Mutations ────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => scheduledReportsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] }); toast({ title: "Programación creada" }); closeForm(); },
    onError: () => { toast({ title: "Error al crear programación", variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => scheduledReportsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] }); toast({ title: "Programación actualizada" }); closeForm(); },
    onError: () => { toast({ title: "Error al actualizar", variant: "destructive" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => scheduledReportsApi.update(id, { isActive }),
    onSuccess: (_data, variables) => { queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] }); toast({ title: variables.isActive ? "Programación reanudada" : "Programación pausada" }); },
    onError: () => { toast({ title: "Error al cambiar estado", variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduledReportsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] }); toast({ title: "Programación eliminada" }); setDeleteTarget(null); },
    onError: () => { toast({ title: "Error al eliminar", variant: "destructive" }); },
  });

  function openCreateForm() { setEditingId(null); setForm(EMPTY_FORM); setFormOpen(true); }
  function openEditForm(report: ScheduledReport) {
    setEditingId(report.id);
    setForm({ name: report.name, type: report.type, frequency: report.frequency, time: report.time || "08:00", dayOfWeek: report.dayOfWeek || "monday", dayOfMonth: String(report.dayOfMonth ?? 1), recipients: Array.isArray(report.recipients) ? report.recipients.join(", ") : "", format: report.format || "pdf", isActive: report.isActive });
    setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setEditingId(null); setForm(EMPTY_FORM); }

  function handleSubmit() {
    if (!form.name.trim()) { toast({ title: "El nombre es requerido", variant: "destructive" }); return; }
    const recipientsList = form.recipients.split(",").map(e => e.trim()).filter(Boolean);
    if (recipientsList.length === 0) { toast({ title: "Se requiere al menos un email destinatario", variant: "destructive" }); return; }
    const payload: Record<string, unknown> = { name: form.name.trim(), type: form.type, frequency: form.frequency, time: form.time, recipients: recipientsList, format: form.format, isActive: form.isActive };
    if (form.frequency === "weekly") payload.dayOfWeek = form.dayOfWeek;
    if (form.frequency === "monthly") payload.dayOfMonth = parseInt(form.dayOfMonth, 10) || 1;
    if (editingId) { updateMutation.mutate({ id: editingId, data: payload }); } else { createMutation.mutate(payload); }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-6 w-6" />
            Reportes Programados
          </h1>
          <p className="text-muted-foreground">Configure y gestione la generación automática de reportes</p>
        </div>
        <Button onClick={openCreateForm} className="gap-1"><Plus className="h-4 w-4" /> Nueva Programación</Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Programaciones Activas</p><p className="text-3xl font-bold text-success">{isLoading ? <Skeleton className="h-9 w-12" /> : activeCount}</p></div><Calendar className="h-8 w-8 text-success" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pausadas</p><p className="text-3xl font-bold text-warning">{isLoading ? <Skeleton className="h-9 w-12" /> : pausedCount}</p></div><PauseCircle className="h-8 w-8 text-warning" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Última Ejecución</p><p className="text-sm font-semibold mt-1">{isLoading ? <Skeleton className="h-5 w-32" /> : getMostRecentRun(reports)}</p></div><Clock className="h-8 w-8 text-primary" /></div></CardContent></Card>
      </div>

      {/* Reports Table */}
      {isLoading ? (
        <Card><CardContent className="pt-6 space-y-4">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-[200px]" /><Skeleton className="h-4 w-[80px]" /><Skeleton className="h-4 w-[160px]" /><Skeleton className="h-4 w-[120px]" /></div>))}</CardContent></Card>
      ) : reports.length === 0 ? (
        <Card><CardContent className="py-16 text-center"><FileBarChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" /><p className="text-lg font-medium">Sin reportes programados</p><p className="text-sm text-muted-foreground mt-1">Cree su primera programación para automatizar reportes.</p><Button onClick={openCreateForm} className="mt-4 gap-1"><Plus className="h-4 w-4" /> Nueva Programación</Button></CardContent></Card>
      ) : (
        <Card><div className="overflow-x-auto"><Table><TableHeader><TableRow>
          <TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Programación</TableHead><TableHead>Destinatarios</TableHead><TableHead>Estado</TableHead><TableHead>Última Ejecución</TableHead><TableHead>Próxima Ejecución</TableHead><TableHead className="text-right">Acciones</TableHead>
        </TableRow></TableHeader><TableBody>
          {reports.map(report => (
            <TableRow key={report.id}>
              <TableCell className="font-medium">{report.name}</TableCell>
              <TableCell><Badge className={reportTypeBadgeColors[report.type] || "bg-gray-500 hover:bg-gray-600"}>{typeLabels[report.type] || report.type}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatSchedule(report)}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{Array.isArray(report.recipients) ? report.recipients.join(", ") : "--"}</TableCell>
              <TableCell>{report.isActive ? <Badge variant="default" className="bg-success hover:bg-success/90">Activa</Badge> : <Badge variant="secondary">Pausada</Badge>}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatTimestamp(report.lastRunAt)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatTimestamp(report.nextRunAt)}</TableCell>
              <TableCell className="text-right"><div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEditForm(report)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate({ id: report.id, isActive: !report.isActive })} title={report.isActive ? "Pausar" : "Reanudar"}>{report.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(report)} title="Eliminar" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div></TableCell>
            </TableRow>
          ))}
        </TableBody></Table></div></Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={open => !open && closeForm()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Reporte Programado" : "Crear Reporte Programado"}</DialogTitle>
            <DialogDescription>{editingId ? "Actualice la configuración de la programación." : "Configure una nueva entrega automática de reportes."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Nombre</Label><Input placeholder="Ej: Resumen semanal de incidentes" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Tipo de Reporte</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger><SelectContent>{REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Frecuencia</Label><Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}><SelectTrigger><SelectValue placeholder="Seleccionar frecuencia" /></SelectTrigger><SelectContent>{SCHEDULE_FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
            {form.frequency === "weekly" && (<div className="grid gap-2"><Label>Día de la Semana</Label><Select value={form.dayOfWeek} onValueChange={v => setForm({ ...form, dayOfWeek: v })}><SelectTrigger><SelectValue placeholder="Seleccionar día" /></SelectTrigger><SelectContent>{WEEKDAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select></div>)}
            {form.frequency === "monthly" && (<div className="grid gap-2"><Label>Día del Mes</Label><Input type="number" min={1} max={28} value={form.dayOfMonth} onChange={e => setForm({ ...form, dayOfMonth: e.target.value })} /></div>)}
            <div className="grid gap-2"><Label>Hora</Label><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Destinatarios (emails separados por coma)</Label><Input placeholder="admin@claveseguridad.co, supervisor@claveseguridad.co" value={form.recipients} onChange={e => setForm({ ...form, recipients: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Formato</Label><Select value={form.format} onValueChange={v => setForm({ ...form, format: v })}><SelectTrigger><SelectValue placeholder="Seleccionar formato" /></SelectTrigger><SelectContent>{FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center justify-between"><Label>Activa</Label><Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? "Guardando..." : editingId ? "Actualizar" : "Crear Programación"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reporte programado?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará permanentemente la programación <span className="font-semibold">"{deleteTarget?.name}"</span>. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteMutation.isPending ? "Eliminando..." : "Eliminar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
