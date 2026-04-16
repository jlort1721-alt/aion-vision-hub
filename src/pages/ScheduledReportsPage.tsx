import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/contexts/I18nContext";
import { scheduledReportsApi } from "@/services/scheduled-reports-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FileBarChart,
  Calendar,
  Clock,
  PauseCircle,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────

const REPORT_TYPE_KEYS = [
  { value: "events", key: "reports.type_events_label" },
  { value: "incidents", key: "reports.type_incidents_label" },
  { value: "devices", key: "reports.type_devices_label" },
  { value: "access", key: "reports.type_access_label" },
  { value: "shifts", key: "reports.type_shifts_label" },
] as const;

const FREQUENCY_KEYS = [
  { value: "daily", key: "reports.freq_daily" },
  { value: "weekly", key: "reports.freq_weekly" },
  { value: "monthly", key: "reports.freq_monthly" },
] as const;

const WEEKDAY_KEYS = [
  { value: "monday", key: "reports.weekday_monday" },
  { value: "tuesday", key: "reports.weekday_tuesday" },
  { value: "wednesday", key: "reports.weekday_wednesday" },
  { value: "thursday", key: "reports.weekday_thursday" },
  { value: "friday", key: "reports.weekday_friday" },
  { value: "saturday", key: "reports.weekday_saturday" },
  { value: "sunday", key: "reports.weekday_sunday" },
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

const typeKeyMap: Record<string, string> = {
  events: "reports.type_events_label",
  incidents: "reports.type_incidents_label",
  devices: "reports.type_devices_label",
  access: "reports.type_access_label",
  shifts: "reports.type_shifts_label",
};

const dayKeyMap: Record<string, string> = {
  monday: "reports.weekday_monday",
  tuesday: "reports.weekday_tuesday",
  wednesday: "reports.weekday_wednesday",
  thursday: "reports.weekday_thursday",
  friday: "reports.weekday_friday",
  saturday: "reports.weekday_saturday",
  sunday: "reports.weekday_sunday",
};

// ── Types ────────────────────────────────────────────────────

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  frequency: string;
  time: string;
  dayOfWeek?: string;
  dayOfMonth?: number;
  recipients: string[];
  format: string;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

interface FormState {
  name: string;
  type: string;
  frequency: string;
  time: string;
  dayOfWeek: string;
  dayOfMonth: string;
  recipients: string;
  format: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "events",
  frequency: "daily",
  time: "08:00",
  dayOfWeek: "monday",
  dayOfMonth: "1",
  recipients: "",
  format: "pdf",
  isActive: true,
};

// ── Helpers ──────────────────────────────────────────────────

function formatTimestamp(iso?: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("es-CO");
}

// ── Component ────────────────────────────────────────────────

export default function ScheduledReportsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledReport | null>(
    null,
  );

  const {
    data: reportsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: () => scheduledReportsApi.list(),
  });

  const reports: ScheduledReport[] = (reportsData?.data ??
    []) as unknown as ScheduledReport[];
  const activeCount = reports.filter((r) => r.isActive).length;
  const pausedCount = reports.filter((r) => !r.isActive).length;

  function formatSchedule(report: ScheduledReport): string {
    const time = report.time || "00:00";
    const dayKey = dayKeyMap[report.dayOfWeek || "monday"];
    switch (report.frequency) {
      case "daily":
        return t("reports.schedule_daily").replace("{time}", time);
      case "weekly":
        return t("reports.schedule_weekly")
          .replace("{day}", dayKey ? t(dayKey) : report.dayOfWeek || "")
          .replace("{time}", time);
      case "monthly":
        return t("reports.schedule_monthly")
          .replace("{dayOfMonth}", String(report.dayOfMonth ?? 1))
          .replace("{time}", time);
      default:
        return report.frequency || t("reports.schedule_undefined");
    }
  }

  function getMostRecentRun(items: ScheduledReport[]): string {
    const timestamps = items
      .map((r) => r.lastRunAt)
      .filter(Boolean)
      .map((ts) => new Date(ts!).getTime());
    if (timestamps.length === 0) return t("reports.no_runs");
    return new Date(Math.max(...timestamps)).toLocaleString("es-CO");
  }

  // ── Mutations ────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      scheduledReportsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: t("reports.schedule_created") });
      closeForm();
    },
    onError: () => {
      toast({ title: t("reports.error_create"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      scheduledReportsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: t("reports.schedule_updated") });
      closeForm();
    },
    onError: () => {
      toast({ title: t("reports.error_update"), variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      scheduledReportsApi.update(id, { isActive }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({
        title: variables.isActive
          ? t("reports.schedule_resumed")
          : t("reports.schedule_paused"),
      });
    },
    onError: () => {
      toast({ title: t("reports.error_toggle"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduledReportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: t("reports.schedule_deleted") });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: t("reports.error_delete"), variant: "destructive" });
    },
  });

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }
  function openEditForm(report: ScheduledReport) {
    setEditingId(report.id);
    setForm({
      name: report.name,
      type: report.type,
      frequency: report.frequency,
      time: report.time || "08:00",
      dayOfWeek: report.dayOfWeek || "monday",
      dayOfMonth: String(report.dayOfMonth ?? 1),
      recipients: Array.isArray(report.recipients)
        ? report.recipients.join(", ")
        : "",
      format: report.format || "pdf",
      isActive: report.isActive,
    });
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: t("reports.name_required"), variant: "destructive" });
      return;
    }
    const recipientsList = form.recipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (recipientsList.length === 0) {
      toast({
        title: t("reports.recipients_required"),
        variant: "destructive",
      });
      return;
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      type: form.type,
      frequency: form.frequency,
      time: form.time,
      recipients: recipientsList,
      format: form.format,
      isActive: form.isActive,
    };
    if (form.frequency === "weekly") payload.dayOfWeek = form.dayOfWeek;
    if (form.frequency === "monthly")
      payload.dayOfMonth = parseInt(form.dayOfMonth, 10) || 1;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
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
            {t("reports.scheduled_title")}
          </h1>
          <p className="text-muted-foreground">
            {t("reports.scheduled_subtitle")}
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-1">
          <Plus className="h-4 w-4" /> {t("reports.new_schedule")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("reports.active_schedules")}
                </p>
                <p className="text-3xl font-bold text-success">
                  {isLoading ? <Skeleton className="h-9 w-12" /> : activeCount}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("reports.paused")}
                </p>
                <p className="text-3xl font-bold text-warning">
                  {isLoading ? <Skeleton className="h-9 w-12" /> : pausedCount}
                </p>
              </div>
              <PauseCircle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("reports.last_run")}
                </p>
                <p className="text-sm font-semibold mt-1">
                  {isLoading ? (
                    <Skeleton className="h-5 w-32" />
                  ) : (
                    getMostRecentRun(reports)
                  )}
                </p>
              </div>
              <Clock className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Table */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[80px]" />
                <Skeleton className="h-4 w-[160px]" />
                <Skeleton className="h-4 w-[120px]" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileBarChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">
              {t("reports.no_scheduled_reports")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("reports.no_scheduled_reports_desc")}
            </p>
            <Button onClick={openCreateForm} className="mt-4 gap-1">
              <Plus className="h-4 w-4" /> {t("reports.new_schedule")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("reports.col_schedule")}</TableHead>
                  <TableHead>{t("reports.col_recipients")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("reports.col_last_run")}</TableHead>
                  <TableHead>{t("reports.col_next_run")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          reportTypeBadgeColors[report.type] ||
                          "bg-gray-500 hover:bg-gray-600"
                        }
                      >
                        {typeKeyMap[report.type]
                          ? t(typeKeyMap[report.type])
                          : report.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatSchedule(report)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {Array.isArray(report.recipients)
                        ? report.recipients.join(", ")
                        : "--"}
                    </TableCell>
                    <TableCell>
                      {report.isActive ? (
                        <Badge
                          variant="default"
                          className="bg-success hover:bg-success/90"
                        >
                          {t("reports.status_active")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t("reports.status_paused")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(report.lastRunAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(report.nextRunAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(report)}
                          title={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            toggleMutation.mutate({
                              id: report.id,
                              isActive: !report.isActive,
                            })
                          }
                          title={
                            report.isActive
                              ? t("reports.schedule_paused")
                              : t("reports.schedule_resumed")
                          }
                        >
                          {report.isActive ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(report)}
                          title={t("common.delete")}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t("reports.edit_scheduled")
                : t("reports.create_scheduled")}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? t("reports.edit_scheduled_desc")
                : t("reports.create_scheduled_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("common.name")}</Label>
              <Input
                placeholder={t("reports.placeholder_name")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("reports.report_type")}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("reports.select_type")} />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPE_KEYS.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {t(rt.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("reports.frequency")}</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("reports.select_frequency")} />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_KEYS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {t(f.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.frequency === "weekly" && (
              <div className="grid gap-2">
                <Label>{t("reports.day_of_week")}</Label>
                <Select
                  value={form.dayOfWeek}
                  onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("reports.select_day")} />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_KEYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {t(d.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.frequency === "monthly" && (
              <div className="grid gap-2">
                <Label>{t("reports.day_of_month")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={form.dayOfMonth}
                  onChange={(e) =>
                    setForm({ ...form, dayOfMonth: e.target.value })
                  }
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>{t("reports.time")}</Label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("reports.recipients_label")}</Label>
              <Input
                placeholder={t("reports.placeholder_recipients")}
                value={form.recipients}
                onChange={(e) =>
                  setForm({ ...form, recipients: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("reports.format")}</Label>
              <Select
                value={form.format}
                onValueChange={(v) => setForm({ ...form, format: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("reports.select_format")} />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("common.active")}</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving
                ? t("reports.saving")
                : editingId
                  ? t("reports.update")
                  : t("reports.create_schedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("reports.delete_scheduled_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("reports.delete_scheduled_desc").replace(
                "{name}",
                deleteTarget?.name || "",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending
                ? t("reports.deleting")
                : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
