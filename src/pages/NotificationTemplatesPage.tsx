import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  notificationTemplatesApi,
  type NotificationTemplate,
  type TemplateVariable,
} from "@/services/notification-templates-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Send,
  Search,
  Mail,
  MessageSquare,
  Bell,
  Globe,
  Lock,
  Loader2,
  Sparkles,
  Copy,
  RefreshCw,
} from "lucide-react";

// -- Constants -------------------------------------------------------

const CATEGORIES = [
  { value: "alert", label: "Alert" },
  { value: "incident", label: "Incident" },
  { value: "shift", label: "Shift" },
  { value: "visitor", label: "Visitor" },
  { value: "access", label: "Access" },
  { value: "system", label: "System" },
  { value: "automation", label: "Automation" },
] as const;

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "push", label: "Push", icon: Bell },
  { value: "all", label: "All Channels", icon: Globe },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  alert: "bg-destructive/15 text-destructive border-destructive/30",
  incident: "bg-warning/15 text-warning border-warning/30",
  shift: "bg-primary/15 text-primary border-primary/30",
  visitor: "bg-success/15 text-success border-success/30",
  access: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  system: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  automation: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageSquare,
  push: Bell,
  all: Globe,
};

// -- Variables per category ------------------------------------------

const CATEGORY_VARIABLES: Record<string, TemplateVariable[]> = {
  alert: [
    { name: "severity", description: "Event severity (critical, high, medium, low, info)" },
    { name: "event_title", description: "Short event title" },
    { name: "event_type", description: "Type of event" },
    { name: "description", description: "Event description" },
    { name: "device_name", description: "Device name" },
    { name: "site_name", description: "Site name" },
    { name: "date", description: "Formatted timestamp" },
  ],
  incident: [
    { name: "incident_id", description: "Incident identifier" },
    { name: "incident_title", description: "Incident title" },
    { name: "priority", description: "Priority level" },
    { name: "status", description: "Current status" },
    { name: "description", description: "Incident description" },
    { name: "assigned_to", description: "Assigned operator" },
    { name: "site_name", description: "Site name" },
    { name: "date", description: "Timestamp" },
  ],
  shift: [
    { name: "from_operator", description: "Outgoing operator" },
    { name: "to_operator", description: "Incoming operator" },
    { name: "site_name", description: "Site name" },
    { name: "notes", description: "Handover notes" },
    { name: "pending_incidents", description: "Pending incident count" },
    { name: "date", description: "Timestamp" },
  ],
  visitor: [
    { name: "visitor_name", description: "Visitor full name" },
    { name: "visitor_company", description: "Visitor company" },
    { name: "site_name", description: "Site name" },
    { name: "host_name", description: "Host being visited" },
    { name: "purpose", description: "Visit purpose" },
    { name: "date", description: "Timestamp" },
  ],
  access: [
    { name: "operator_name", description: "Operator name" },
    { name: "site_name", description: "Site name" },
    { name: "reason", description: "Reason for action" },
    { name: "gate_name", description: "Gate/barrier name" },
    { name: "date", description: "Timestamp" },
  ],
  system: [
    { name: "device_name", description: "Device name" },
    { name: "device_ip", description: "Device IP address" },
    { name: "site_name", description: "Site name" },
    { name: "last_seen", description: "Last seen timestamp" },
    { name: "device_type", description: "Device type" },
    { name: "events_count", description: "Event count" },
    { name: "incidents_count", description: "Incident count" },
    { name: "date", description: "Timestamp" },
  ],
  automation: [
    { name: "rule_name", description: "Automation rule name" },
    { name: "event_type", description: "Triggering event type" },
    { name: "severity", description: "Severity level" },
    { name: "device_name", description: "Device name" },
    { name: "site_name", description: "Site name" },
    { name: "action_result", description: "Action execution result" },
    { name: "date", description: "Timestamp" },
  ],
};

// -- Helper ----------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// -- Page Component --------------------------------------------------

export default function NotificationTemplatesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("__all__");
  const [filterChannel, setFilterChannel] = useState<string>("__all__");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string | null; body: string } | null>(null);
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [testTemplateId, setTestTemplateId] = useState("");
  const [testChannel, setTestChannel] = useState<"email" | "whatsapp" | "push">("email");
  const [testRecipient, setTestRecipient] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("alert");
  const [formChannel, setFormChannel] = useState("all");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formVariables, setFormVariables] = useState<TemplateVariable[]>([]);

  // -- Queries -------------------------------------------------------

  const { data: templatesResult, isLoading } = useQuery({
    queryKey: [
      "notification-templates",
      filterCategory,
      filterChannel,
      searchTerm,
    ],
    queryFn: () =>
      notificationTemplatesApi.list({
        category: filterCategory !== "__all__" ? filterCategory : undefined,
        channel: filterChannel !== "__all__" ? filterChannel : undefined,
        search: searchTerm || undefined,
        perPage: 50,
      }),
  });

  const templates = templatesResult?.data ?? [];

  // -- Mutations -----------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof notificationTemplatesApi.create>[0]) =>
      notificationTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast({ title: "Template created" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Error creating template", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof notificationTemplatesApi.update>[1] }) =>
      notificationTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast({ title: "Template updated" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Error updating template", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error deleting template", description: err.message, variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (id: string) => notificationTemplatesApi.preview(id),
    onSuccess: (res) => {
      setPreviewData(res.data);
      setPreviewOpen(true);
    },
    onError: (err: Error) => {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: (params: Parameters<typeof notificationTemplatesApi.sendTest>[0]) =>
      notificationTemplatesApi.sendTest(params),
    onSuccess: (res) => {
      if (res.data.success) {
        toast({ title: "Test notification sent", description: `Sent via ${res.data.channel} to ${res.data.recipient}` });
      } else {
        toast({ title: "Test failed", description: res.data.error ?? "Unknown error", variant: "destructive" });
      }
      setSendTestOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Send test failed", description: err.message, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => notificationTemplatesApi.seed(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast({ title: "Default templates seeded", description: `${res.data.seeded} created, ${res.data.skipped} already existed` });
    },
    onError: (err: Error) => {
      toast({ title: "Seed failed", description: err.message, variant: "destructive" });
    },
  });

  // -- Helpers -------------------------------------------------------

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormName("");
    setFormDescription("");
    setFormCategory("alert");
    setFormChannel("all");
    setFormSubject("");
    setFormBody("");
    setFormVariables([]);
    setDialogOpen(true);
  }

  function openEditDialog(tpl: NotificationTemplate) {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormDescription(tpl.description ?? "");
    setFormCategory(tpl.category);
    setFormChannel(tpl.channel);
    setFormSubject(tpl.subject ?? "");
    setFormBody(tpl.bodyTemplate);
    setFormVariables(tpl.variables ?? []);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingTemplate(null);
  }

  function handleSave() {
    const payload = {
      name: formName,
      description: formDescription || undefined,
      category: formCategory,
      channel: formChannel,
      subject: formSubject || undefined,
      bodyTemplate: formBody,
      variables: formVariables.length > 0 ? formVariables : undefined,
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function insertVariable(varName: string) {
    setFormBody((prev) => prev + `{{${varName}}}`);
  }

  function openSendTest(tplId: string) {
    setTestTemplateId(tplId);
    setTestChannel("email");
    setTestRecipient("");
    setSendTestOpen(true);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // -- Render --------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Notification Templates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage unified notification templates for email, WhatsApp, and push notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Seed Defaults
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            New Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Channels</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterCategory !== "__all__" || filterChannel !== "__all__" || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCategory("__all__");
                  setFilterChannel("__all__");
                  setSearchTerm("");
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Templates</CardTitle>
          <CardDescription>
            {templates.length} template{templates.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">No templates found.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Click "Seed Defaults" to create the default system templates, or create a new one.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((tpl) => {
                    const ChannelIcon = CHANNEL_ICONS[tpl.channel] ?? Globe;
                    return (
                      <TableRow key={tpl.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {tpl.isSystem && (
                              <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <div>
                              <div className="font-medium text-sm">{tpl.name}</div>
                              {tpl.description && (
                                <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                                  {tpl.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${CATEGORY_COLORS[tpl.category] ?? ""}`}
                          >
                            {tpl.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="capitalize">{tpl.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {(tpl.variables ?? []).length} var{(tpl.variables ?? []).length !== 1 ? "s" : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(tpl.updatedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(tpl)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => previewMutation.mutate(tpl.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openSendTest(tpl.id)}>
                                <Send className="h-4 w-4 mr-2" />
                                Send Test
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={tpl.isSystem}
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  if (confirm(`Delete template "${tpl.name}"?`)) {
                                    deleteMutation.mutate(tpl.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {tpl.isSystem ? "System (locked)" : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create / Edit Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Modify the notification template settings and body."
                : "Define a new notification template with placeholders for dynamic content."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. device_offline"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Input
                id="tpl-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={formChannel} onValueChange={setFormChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <c.icon className="h-3.5 w-3.5" />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject (email) */}
          {(formChannel === "email" || formChannel === "all") && (
            <div className="space-y-2">
              <Label htmlFor="tpl-subject">Subject (email)</Label>
              <Input
                id="tpl-subject"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. [{{severity}}] {{event_title}} at {{site_name}}"
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* Body + Variables Panel */}
          <div className="grid grid-cols-3 gap-4">
            {/* Body Editor */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="tpl-body">Body Template</Label>
              <Textarea
                id="tpl-body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Use {{variable}} for placeholders, {{#if var}}...{{/if}} for conditionals"
                className="font-mono text-sm min-h-[240px] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Syntax: {"{{variable}}"} for values, {"{{#if var}}...{{/if}}"} for conditionals, {"{{date}}"} for current timestamp.
              </p>
            </div>

            {/* Variables Reference */}
            <div className="space-y-2">
              <Label>Available Variables</Label>
              <div className="rounded-md border p-3 max-h-[260px] overflow-y-auto space-y-1">
                {(CATEGORY_VARIABLES[formCategory] ?? []).map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    className="w-full text-left px-2 py-1.5 rounded-sm hover:bg-accent/50 transition-colors group"
                    onClick={() => insertVariable(v.name)}
                    title={`Click to insert {{${v.name}}}`}
                  >
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono text-primary">
                        {`{{${v.name}}}`}
                      </code>
                      <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {v.description && (
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {v.description}
                      </div>
                    )}
                  </button>
                ))}
                {(CATEGORY_VARIABLES[formCategory] ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    No predefined variables for this category.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName || !formBody || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              Rendered with sample data from the template variables.
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              {previewData.subject && (
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <div className="mt-1 p-2 rounded-md bg-muted text-sm font-medium">
                    {previewData.subject}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Body</Label>
                <pre className="mt-1 p-3 rounded-md bg-muted text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                  {previewData.body}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Test Dialog ──────────────────────────────────── */}
      <Dialog open={sendTestOpen} onOpenChange={setSendTestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Test Notification</DialogTitle>
            <DialogDescription>
              Send a test notification using this template with sample data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={testChannel} onValueChange={(v) => setTestChannel(v as typeof testChannel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </div>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                    </div>
                  </SelectItem>
                  <SelectItem value="push">
                    <div className="flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5" /> Push
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-recipient">
                {testChannel === "email"
                  ? "Email Address"
                  : testChannel === "whatsapp"
                    ? "Phone Number"
                    : "User ID"}
              </Label>
              <Input
                id="test-recipient"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder={
                  testChannel === "email"
                    ? "test@example.com"
                    : testChannel === "whatsapp"
                      ? "+57300..."
                      : "user-uuid"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendTestOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                sendTestMutation.mutate({
                  templateId: testTemplateId,
                  channel: testChannel,
                  recipient: testRecipient,
                })
              }
              disabled={!testRecipient || sendTestMutation.isPending}
            >
              {sendTestMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              <Send className="h-4 w-4 mr-1" />
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
