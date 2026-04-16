// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Escalation Configuration Panel
// Full CRUD UI for escalation policies with visual timeline
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { escalationPoliciesApi } from "@/services/alerts-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpCircle,
  ChevronUp,
  ChevronDown,
  Play,
  Clock,
  Mail,
  MessageSquare,
  Bell,
  Globe,
  Users,
  Zap,
  ArrowRight,
  RotateCcw,
  Eye,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────

const NOTIFICATION_CHANNELS = ["email", "whatsapp", "push", "webhook"] as const;
type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

const RECIPIENT_ROLES = ["operator", "tenant_admin", "super_admin"] as const;
type RecipientRole = (typeof RECIPIENT_ROLES)[number];

const DELAY_OPTIONS = [5, 10, 15, 30, 60] as const;

interface EscalationStep {
  level: number;
  timeoutMinutes: number;
  notifyRoles: string[];
  notifyUsers: string[];
  notifyChannelIds: string[];
  channels: NotificationChannel[];
  messageOverride: string;
}

interface PolicyFormData {
  name: string;
  description: string;
  steps: EscalationStep[];
  isActive: boolean;
  repeat: boolean;
  maxRepeats: number;
}

interface EscalationLevel {
  level?: number;
  timeoutMinutes?: number;
  notifyRoles?: string[];
  notifyUsers?: string[];
  notifyChannelIds?: string[];
  channels?: string[];
  messageOverride?: string;
  __meta?: { repeat?: boolean; maxRepeats?: number };
}

interface EscalationPolicy {
  id: string;
  name: string;
  description: string | null;
  levels: EscalationLevel[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────

const channelIcons: Record<NotificationChannel, typeof Mail> = {
  email: Mail,
  whatsapp: MessageSquare,
  push: Bell,
  webhook: Globe,
};

const channelLabels: Record<NotificationChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  push: "Push",
  webhook: "Webhook",
};

const roleLabels: Record<RecipientRole, string> = {
  operator: "Operator",
  tenant_admin: "Tenant Admin",
  super_admin: "Super Admin",
};

const urgencyColors = [
  "bg-primary",
  "bg-warning",
  "bg-orange-500",
  "bg-destructive",
  "bg-destructive/80",
];

const urgencyTextColors = [
  "text-primary",
  "text-warning",
  "text-orange-500",
  "text-destructive",
  "text-destructive/80",
];

function createEmptyStep(level: number): EscalationStep {
  return {
    level,
    timeoutMinutes: 15,
    notifyRoles: [],
    notifyUsers: [],
    notifyChannelIds: [],
    channels: [],
    messageOverride: "",
  };
}

function createEmptyFormData(): PolicyFormData {
  return {
    name: "",
    description: "",
    steps: [createEmptyStep(1)],
    isActive: true,
    repeat: false,
    maxRepeats: 1,
  };
}

/** Convert backend policy levels to form steps */
function policyToFormData(policy: EscalationPolicy): PolicyFormData {
  const levels = policy.levels ?? [];
  const meta = levels.length > 0 && levels[levels.length - 1]?.__meta
    ? levels[levels.length - 1].__meta
    : null;

  const steps: EscalationStep[] = levels
    .filter((l) => !l.__meta)
    .map((l, i) => ({
      level: i + 1,
      timeoutMinutes: l.timeoutMinutes ?? 15,
      notifyRoles: l.notifyRoles ?? [],
      notifyUsers: l.notifyUsers ?? [],
      notifyChannelIds: l.notifyChannelIds ?? [],
      channels: l.channels ?? [],
      messageOverride: l.messageOverride ?? "",
    }));

  return {
    name: policy.name,
    description: policy.description ?? "",
    steps: steps.length > 0 ? steps : [createEmptyStep(1)],
    isActive: policy.isActive,
    repeat: meta?.repeat ?? false,
    maxRepeats: meta?.maxRepeats ?? 1,
  };
}

/** Convert form data to backend API shape */
function formDataToApiPayload(form: PolicyFormData) {
  const levels = form.steps.map((step, i) => ({
    level: i + 1,
    timeoutMinutes: step.timeoutMinutes,
    notifyRoles: step.notifyRoles,
    notifyUsers: step.notifyUsers,
    notifyChannelIds: step.notifyChannelIds,
    channels: step.channels,
    messageOverride: step.messageOverride || undefined,
  }));

  // Store repeat settings as metadata in a special entry
  if (form.repeat) {
    (levels as EscalationLevel[]).push({
      __meta: { repeat: true, maxRepeats: form.maxRepeats },
    });
  }

  return {
    name: form.name,
    description: form.description || undefined,
    levels,
    isActive: form.isActive,
  };
}

// ── Simulation Types ──────────────────────────────────────

interface SimulationEvent {
  minutesFromTrigger: number;
  level: number;
  channels: NotificationChannel[];
  roles: string[];
  isRepeat: boolean;
  repeatNumber: number;
}

function simulateEscalation(form: PolicyFormData): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  const maxIterations = form.repeat ? form.maxRepeats + 1 : 1;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let cumulativeMinutes = 0;
    for (let i = 0; i < form.steps.length; i++) {
      const step = form.steps[i];
      if (i > 0 || iteration > 0) {
        cumulativeMinutes += form.steps[i > 0 ? i - 1 : form.steps.length - 1].timeoutMinutes;
      }
      events.push({
        minutesFromTrigger: cumulativeMinutes,
        level: step.level,
        channels: step.channels,
        roles: step.notifyRoles,
        isRepeat: iteration > 0,
        repeatNumber: iteration,
      });
    }
  }

  return events;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function EscalationConfigPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [simulateDialogOpen, setSimulateDialogOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);
  const [simulatingForm, setSimulatingForm] = useState<PolicyFormData | null>(null);
  const [form, setForm] = useState<PolicyFormData>(createEmptyFormData());

  // ── Queries ────────────────────────────────────────────
  const { data: policiesResponse, isLoading } = useQuery({
    queryKey: ["alerts", "policies"],
    queryFn: () => escalationPoliciesApi.list(),
  });

  const policies: EscalationPolicy[] = (policiesResponse?.data ?? []) as EscalationPolicy[];

  // ── Mutations ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => escalationPoliciesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "policies"] });
      toast({ title: "Escalation policy created" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Failed to create policy", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      escalationPoliciesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "policies"] });
      toast({ title: "Escalation policy updated" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Failed to update policy", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => escalationPoliciesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "policies"] });
      toast({ title: "Escalation policy deleted" });
      setDeleteDialogOpen(false);
      setDeletingPolicyId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete policy", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      escalationPoliciesApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "policies"] });
      toast({ title: "Policy status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  // ── Dialog Handlers ────────────────────────────────────

  function openCreateDialog() {
    setEditingPolicyId(null);
    setForm(createEmptyFormData());
    setDialogOpen(true);
  }

  function openEditDialog(policy: EscalationPolicy) {
    setEditingPolicyId(policy.id);
    setForm(policyToFormData(policy));
    setDialogOpen(true);
  }

  function openDeleteDialog(policyId: string) {
    setDeletingPolicyId(policyId);
    setDeleteDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingPolicyId(null);
    setForm(createEmptyFormData());
  }

  function openSimulateDialog(policy?: EscalationPolicy) {
    const formData = policy ? policyToFormData(policy) : form;
    setSimulatingForm(formData);
    setSimulateDialogOpen(true);
  }

  // ── Form Handlers ──────────────────────────────────────

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Policy name is required", variant: "destructive" });
      return;
    }
    if (form.steps.length === 0) {
      toast({ title: "At least one step is required", variant: "destructive" });
      return;
    }

    const hasEmptyStep = form.steps.some(
      (s) => s.notifyRoles.length === 0 && s.channels.length === 0
    );
    if (hasEmptyStep) {
      toast({
        title: "Each step must have at least one recipient role and one notification channel",
        variant: "destructive",
      });
      return;
    }

    const payload = formDataToApiPayload(form);

    if (editingPolicyId) {
      updateMutation.mutate({ id: editingPolicyId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const updateStep = useCallback(
    (index: number, updates: Partial<EscalationStep>) => {
      setForm((prev) => ({
        ...prev,
        steps: prev.steps.map((s, i) => (i === index ? { ...s, ...updates } : s)),
      }));
    },
    []
  );

  function addStep() {
    if (form.steps.length >= 5) {
      toast({ title: "Maximum 5 escalation steps allowed", variant: "destructive" });
      return;
    }
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, createEmptyStep(prev.steps.length + 1)],
    }));
  }

  function removeStep(index: number) {
    if (form.steps.length <= 1) {
      toast({ title: "At least one step is required", variant: "destructive" });
      return;
    }
    setForm((prev) => ({
      ...prev,
      steps: prev.steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, level: i + 1 })),
    }));
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= form.steps.length) return;

    setForm((prev) => {
      const newSteps = [...prev.steps];
      [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
      return {
        ...prev,
        steps: newSteps.map((s, i) => ({ ...s, level: i + 1 })),
      };
    });
  }

  function toggleChannel(stepIndex: number, channel: NotificationChannel) {
    const step = form.steps[stepIndex];
    const newChannels = (step.channels || []).includes(channel)
      ? (step.channels || []).filter((c) => c !== channel)
      : [...(step.channels || []), channel];
    updateStep(stepIndex, { channels: newChannels });
  }

  function toggleRole(stepIndex: number, role: RecipientRole) {
    const step = form.steps[stepIndex];
    const newRoles = (step.notifyRoles || []).includes(role)
      ? (step.notifyRoles || []).filter((r) => r !== role)
      : [...(step.notifyRoles || []), role];
    updateStep(stepIndex, { notifyRoles: newRoles });
  }

  // ── Computed ───────────────────────────────────────────

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function getStepCount(policy: EscalationPolicy): number {
    return (policy.levels ?? []).filter((l) => !l.__meta).length;
  }

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            Escalation Policies
          </h2>
          <p className="text-sm text-muted-foreground">
            Define how unacknowledged alerts escalate through notification tiers
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-1">
          <Plus className="h-4 w-4" /> New Policy
        </Button>
      </div>

      {/* ── Policy List / Table ──────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowUpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No escalation policies</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first policy to define how alerts escalate when unacknowledged
            </p>
            <Button onClick={openCreateDialog} className="mt-4 gap-1">
              <Plus className="h-4 w-4" /> Create Policy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="text-center">Steps</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell className="font-medium">{policy.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                    {policy.description || "No description"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{getStepCount(policy)}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {new Date(policy.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={policy.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: policy.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSimulateDialog(policy)}
                        title="Simulate escalation"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(policy)}
                        title="Edit policy"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(policy.id)}
                        title="Delete policy"
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
        </Card>
      )}

      {/* ── Visual Timeline Preview (for existing policies) */}
      {policies.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Escalation Timelines
          </h3>
          {policies.filter((p) => p.isActive).map((policy) => (
            <EscalationTimelineCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ──────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicyId ? "Edit Escalation Policy" : "Create Escalation Policy"}
            </DialogTitle>
            <DialogDescription>
              Define the escalation chain for unacknowledged alerts. Each step triggers after the previous step's timeout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Policy Name */}
            <div className="space-y-2">
              <Label htmlFor="policy-name">Policy Name *</Label>
              <Input
                id="policy-name"
                placeholder="e.g., Critical Alert Escalation"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="policy-desc">Description</Label>
              <Textarea
                id="policy-desc"
                placeholder="Describe when this policy should be used..."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
              />
              <Label>Active</Label>
            </div>

            {/* ── Steps Builder ──────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Escalation Steps</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStep}
                  disabled={form.steps.length >= 5}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Step
                </Button>
              </div>

              {form.steps.map((step, index) => (
                <StepEditor
                  key={index}
                  step={step}
                  index={index}
                  totalSteps={form.steps.length}
                  onUpdate={updateStep}
                  onRemove={removeStep}
                  onMove={moveStep}
                  onToggleChannel={toggleChannel}
                  onToggleRole={toggleRole}
                />
              ))}
            </div>

            {/* ── Repeat Settings ────────────────────── */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={form.repeat}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, repeat: checked === true }))
                      }
                    />
                    <div>
                      <Label className="font-medium flex items-center gap-1.5">
                        <RotateCcw className="h-4 w-4" />
                        Repeat Escalation
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Restart the escalation chain after all steps are exhausted
                      </p>
                    </div>
                  </div>
                  {form.repeat && (
                    <div className="flex items-center gap-3 ml-7">
                      <Label htmlFor="max-repeats">Max Repeats</Label>
                      <Input
                        id="max-repeats"
                        type="number"
                        min={1}
                        max={10}
                        className="w-20"
                        value={form.maxRepeats}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            maxRepeats: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Inline Timeline Preview ────────────── */}
            {form.steps.length > 0 && form.steps[0].channels.length > 0 && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Timeline Preview</Label>
                <InlineTimeline steps={form.steps} />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => openSimulateDialog()}
              disabled={form.steps.length === 0}
              className="gap-1 mr-auto"
            >
              <Play className="h-4 w-4" /> Simulate
            </Button>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <div className="animate-spin w-4 h-4 border-2 border-background border-t-transparent rounded-full mr-2" />
              ) : null}
              {editingPolicyId ? "Update Policy" : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Escalation Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this escalation policy? This action cannot be undone.
              Any alert rules referencing this policy will no longer have escalation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingPolicyId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPolicyId && deleteMutation.mutate(deletingPolicyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Simulate Dialog ────────────────────────────── */}
      <Dialog open={simulateDialogOpen} onOpenChange={setSimulateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Escalation Simulation
            </DialogTitle>
            <DialogDescription>
              Preview of notification timeline for a test alert using this policy
            </DialogDescription>
          </DialogHeader>
          {simulatingForm && <SimulationView form={simulatingForm} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STEP EDITOR SUB-COMPONENT
// ═══════════════════════════════════════════════════════════

interface StepEditorProps {
  step: EscalationStep;
  index: number;
  totalSteps: number;
  onUpdate: (index: number, updates: Partial<EscalationStep>) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onToggleChannel: (stepIndex: number, channel: NotificationChannel) => void;
  onToggleRole: (stepIndex: number, role: RecipientRole) => void;
}

function StepEditor({
  step,
  index,
  totalSteps,
  onUpdate,
  onRemove,
  onMove,
  onToggleChannel,
  onToggleRole,
}: StepEditorProps) {
  const colorClass = urgencyColors[Math.min(index, urgencyColors.length - 1)];
  const textColorClass = urgencyTextColors[Math.min(index, urgencyTextColors.length - 1)];

  return (
    <Card className="relative">
      {/* Level indicator bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colorClass}`} />

      <CardHeader className="pb-3 pl-5">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${textColorClass}`}>
            <Zap className="h-4 w-4" />
            Step {index + 1}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(index, "up")}
              disabled={index === 0}
              className="h-7 w-7 p-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(index, "down")}
              disabled={index === totalSteps - 1}
              className="h-7 w-7 p-0"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              disabled={totalSteps <= 1}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pl-5">
        {/* Delay */}
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {index === 0 ? "Trigger after (minutes)" : "Delay after previous step (minutes)"}
          </Label>
          <Select
            value={String(step.timeoutMinutes)}
            onValueChange={(val) => onUpdate(index, { timeoutMinutes: parseInt(val) })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELAY_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notification Channels */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Notification Channels</Label>
          <div className="flex flex-wrap gap-3">
            {NOTIFICATION_CHANNELS.map((channel) => {
              const Icon = channelIcons[channel];
              const isChecked = (step.channels || []).includes(channel);
              return (
                <label
                  key={channel}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                    isChecked
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => onToggleChannel(index, channel)}
                  />
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{channelLabels[channel]}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Recipients (Roles) */}
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Recipients
          </Label>
          <div className="flex flex-wrap gap-3">
            {RECIPIENT_ROLES.map((role) => {
              const isChecked = (step.notifyRoles || []).includes(role);
              return (
                <label
                  key={role}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                    isChecked
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => onToggleRole(index, role)}
                  />
                  <span className="text-sm">{roleLabels[role]}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Message Override */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Message Override (optional)</Label>
          <Textarea
            placeholder="Leave empty to use the default alert template..."
            value={step.messageOverride}
            onChange={(e) => onUpdate(index, { messageOverride: e.target.value })}
            rows={2}
            className="text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// INLINE TIMELINE
// ═══════════════════════════════════════════════════════════

function InlineTimeline({ steps }: { steps: EscalationStep[] }) {
  let cumulativeMinutes = 0;

  return (
    <div className="flex items-center gap-1 flex-wrap p-4 bg-muted/30 rounded-lg border">
      {/* Trigger */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-1.5 rounded-full text-xs font-medium">
          <Zap className="h-3 w-3" />
          Alert Triggered
        </div>
      </div>

      {steps.map((step, i) => {
        if (i > 0) {
          cumulativeMinutes += steps[i - 1].timeoutMinutes;
        }
        const colorClass = urgencyColors[Math.min(i, urgencyColors.length - 1)];

        return (
          <div key={i} className="flex items-center gap-1">
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-[10px] text-muted-foreground shrink-0">
              {i === 0 ? `+${step.timeoutMinutes}m` : `+${steps[i - 1].timeoutMinutes}m`}
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white ${colorClass}`}
            >
              L{i + 1}: {step.notifyRoles.map((r) => roleLabels[r as RecipientRole] ?? r).join(", ") || "No recipients"}
              <span className="opacity-75">
                ({(step.channels || []).map((c) => channelLabels[c]).join(", ") || "No channels"})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ESCALATION TIMELINE CARD (for list view)
// ═══════════════════════════════════════════════════════════

function EscalationTimelineCard({ policy }: { policy: EscalationPolicy }) {
  const levels = (policy.levels ?? []).filter((l) => !l.__meta);

  if (levels.length === 0) return null;

  let cumulativeMinutes = 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{policy.name}</CardTitle>
          <Badge variant={policy.isActive ? "default" : "secondary"}>
            {policy.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {/* Trigger node */}
            <div className="flex items-center gap-3 relative">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10 shrink-0">
                <Zap className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">Alert Triggered</span>
              <span className="text-xs text-muted-foreground">(T+0)</span>
            </div>

            {levels.map((level: any, i: number) => {
              if (i > 0) {
                cumulativeMinutes += levels[i - 1].timeoutMinutes ?? 15;
              } else {
                cumulativeMinutes = level.timeoutMinutes ?? 15;
              }
              const colorClass = urgencyColors[Math.min(i, urgencyColors.length - 1)];
              const channels: string[] = level.channels ?? [];
              const roles: string[] = level.notifyRoles ?? [];

              return (
                <div key={i} className="flex items-start gap-3 relative">
                  <div
                    className={`w-6 h-6 rounded-full ${colorClass} flex items-center justify-center z-10 shrink-0 text-white text-xs font-bold`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {roles.map((r: string) => roleLabels[r as RecipientRole] ?? r).join(", ") || "Assigned users"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        T+{cumulativeMinutes}min
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {channels.map((c: string) => {
                        const Icon = channelIcons[c as NotificationChannel] ?? Bell;
                        return (
                          <Badge key={c} variant="outline" className="text-xs gap-1">
                            <Icon className="h-3 w-3" />
                            {channelLabels[c as NotificationChannel] ?? c}
                          </Badge>
                        );
                      })}
                      {channels.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          via {(level.notifyRoles ?? []).join(", ") || "default channels"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// SIMULATION VIEW
// ═══════════════════════════════════════════════════════════

function SimulationView({ form }: { form: PolicyFormData }) {
  const events = simulateEscalation(form);

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No steps configured to simulate</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{form.steps.length}</p>
              <p className="text-xs text-muted-foreground">Escalation Steps</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {form.steps.reduce((sum, s) => sum + s.timeoutMinutes, 0)}m
              </p>
              <p className="text-xs text-muted-foreground">Total Duration</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{events.length}</p>
              <p className="text-xs text-muted-foreground">
                Notifications {form.repeat ? `(${form.maxRepeats + 1}x)` : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test alert header */}
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          <span className="text-sm font-medium">Test Alert: Camera Offline - Front Entrance</span>
          <Badge className="bg-destructive text-xs">critical</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-4">
          Device has not sent a heartbeat in the last 5 minutes
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4">
          {events.map((event, i) => {
            const colorClass = urgencyColors[Math.min(event.level - 1, urgencyColors.length - 1)];

            return (
              <div key={i} className="flex items-start gap-4 relative">
                <div
                  className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center z-10 shrink-0 text-white text-xs font-bold`}
                >
                  {event.isRepeat ? (
                    <RotateCcw className="h-3.5 w-3.5" />
                  ) : (
                    event.level
                  )}
                </div>
                <div className="flex-1 bg-card border rounded-lg p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {event.isRepeat && (
                          <span className="text-muted-foreground">
                            [Repeat #{event.repeatNumber}]{" "}
                          </span>
                        )}
                        Step {event.level}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        T+{event.minutesFromTrigger}m
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {event.roles.length > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Notify: {event.roles.map((r) => roleLabels[r as RecipientRole] ?? r).join(", ")}
                      </p>
                    )}
                    {event.channels.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {(event.channels || []).map((c) => {
                          const Icon = channelIcons[c];
                          return (
                            <Badge key={c} variant="secondary" className="text-xs gap-1">
                              <Icon className="h-3 w-3" />
                              {channelLabels[c]}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* End node */}
          <div className="flex items-start gap-4 relative">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center z-10 shrink-0">
              {form.repeat ? (
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2 pt-1.5">
              <span className="text-sm text-muted-foreground">
                {form.repeat
                  ? `Escalation repeats up to ${form.maxRepeats} time(s)`
                  : "Escalation complete -- awaiting manual intervention"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
