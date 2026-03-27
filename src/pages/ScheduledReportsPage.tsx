import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

const REPORT_TYPES = [
  { value: "events", label: "Events" },
  { value: "incidents", label: "Incidents" },
  { value: "devices", label: "Devices" },
  { value: "access", label: "Access" },
  { value: "shifts", label: "Shifts" },
] as const;

const SCHEDULE_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const WEEKDAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
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

function formatSchedule(report: ScheduledReport): string {
  const time = report.time || "00:00";
  switch (report.frequency) {
    case "daily":
      return `Daily at ${time}`;
    case "weekly":
      return `Weekly on ${capitalize(report.dayOfWeek || "monday")} at ${time}`;
    case "monthly":
      return `Monthly on day ${report.dayOfMonth ?? 1} at ${time}`;
    default:
      return report.frequency || "Not set";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString();
}

function getMostRecentRun(reports: ScheduledReport[]): string {
  const timestamps = reports
    .map((r) => r.lastRunAt)
    .filter(Boolean)
    .map((t) => new Date(t!).getTime());
  if (timestamps.length === 0) return "No runs yet";
  return new Date(Math.max(...timestamps)).toLocaleString();
}

// ── Component ────────────────────────────────────────────────

export default function ScheduledReportsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledReport | null>(null);

  // ── Queries ──────────────────────────────────────────────

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: () => scheduledReportsApi.list(),
  });

  const reports: ScheduledReport[] = (reportsData?.data ?? []) as ScheduledReport[];
  const activeCount = reports.filter((r) => r.isActive).length;
  const pausedCount = reports.filter((r) => !r.isActive).length;

  // ── Mutations ────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => scheduledReportsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: "Report schedule created" });
      closeForm();
    },
    onError: () => {
      toast({ title: "Failed to create report schedule", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      scheduledReportsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: "Report schedule updated" });
      closeForm();
    },
    onError: () => {
      toast({ title: "Failed to update report schedule", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      scheduledReportsApi.update(id, { isActive }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: variables.isActive ? "Report schedule resumed" : "Report schedule paused" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduledReportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: "Report schedule deleted" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Failed to delete report schedule", variant: "destructive" });
    },
  });

  // ── Form helpers ─────────────────────────────────────────

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
      recipients: Array.isArray(report.recipients) ? report.recipients.join(", ") : "",
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
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    const recipientsList = form.recipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipientsList.length === 0) {
      toast({ title: "At least one recipient email is required", variant: "destructive" });
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

    if (form.frequency === "weekly") {
      payload.dayOfWeek = form.dayOfWeek;
    }
    if (form.frequency === "monthly") {
      payload.dayOfMonth = parseInt(form.dayOfMonth, 10) || 1;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-6 w-6" />
            Scheduled Reports
          </h1>
          <p className="text-muted-foreground">
            Configure and manage automated report generation
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-1">
          <Plus className="h-4 w-4" /> New Schedule
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Schedules</p>
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
                <p className="text-sm text-muted-foreground">Paused</p>
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
                <p className="text-sm text-muted-foreground">Last Run</p>
                <p className="text-sm font-semibold mt-1">
                  {isLoading ? <Skeleton className="h-5 w-32" /> : getMostRecentRun(reports)}
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
                <Skeleton className="h-4 w-[60px]" />
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[100px]" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileBarChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No scheduled reports</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first scheduled report to automate reporting.
            </p>
            <Button onClick={openCreateForm} className="mt-4 gap-1">
              <Plus className="h-4 w-4" /> New Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          reportTypeBadgeColors[report.type] || "bg-gray-500 hover:bg-gray-600"
                        }
                      >
                        {capitalize(report.type)}
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
                        <Badge variant="default" className="bg-success hover:bg-success/90">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
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
                          title="Edit"
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
                          title={report.isActive ? "Pause" : "Resume"}
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
                          title="Delete"
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
              {editingId ? "Edit Scheduled Report" : "Create Scheduled Report"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the report schedule configuration."
                : "Set up a new automated report delivery schedule."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="report-name">Name</Label>
              <Input
                id="report-name"
                placeholder="e.g. Weekly Incident Summary"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label>Report Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frequency */}
            <div className="grid gap-2">
              <Label>Schedule Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(value) => setForm({ ...form, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day of Week (weekly only) */}
            {form.frequency === "weekly" && (
              <div className="grid gap-2">
                <Label>Day of Week</Label>
                <Select
                  value={form.dayOfWeek}
                  onValueChange={(value) => setForm({ ...form, dayOfWeek: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Day of Month (monthly only) */}
            {form.frequency === "monthly" && (
              <div className="grid gap-2">
                <Label htmlFor="day-of-month">Day of Month</Label>
                <Input
                  id="day-of-month"
                  type="number"
                  min={1}
                  max={28}
                  value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                />
              </div>
            )}

            {/* Time */}
            <div className="grid gap-2">
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>

            {/* Recipients */}
            <div className="grid gap-2">
              <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
              <Input
                id="recipients"
                placeholder="user@example.com, admin@example.com"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              />
            </div>

            {/* Format */}
            <div className="grid gap-2">
              <Label>Format</Label>
              <Select
                value={form.format}
                onValueChange={(value) => setForm({ ...form, format: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
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

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="report-enabled">Enabled</Label>
              <Switch
                id="report-enabled"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update Schedule" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scheduled report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the schedule{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
