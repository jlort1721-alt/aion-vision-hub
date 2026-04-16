import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIncidents, useSites } from "@/hooks/use-api-data";
import type { ApiIncident, ApiSite } from "@/types/api-entities";
import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/contexts/I18nContext";
import { formatDateTime } from "@/lib/date-utils";
import { toast } from "sonner";
import {
  AlertTriangle,
  AlertCircle,
  Plus,
  Search,
  MessageSquare,
  Bot,
  Clock,
  User,
  CheckCircle2,
  Loader2,
  XCircle,
  Shield,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeText } from "@/lib/sanitize";

function formatIncidentDescription(text: string): string {
  if (!text) return "";
  const cleaned = sanitizeText(text);
  // Detect raw JSON metadata in descriptions from automation engine
  const jsonMatch = cleaned.match(/Metadata:\s*(\{[\s\S]*\})\s*$/);
  if (jsonMatch) {
    try {
      const meta = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      const prefix = cleaned.slice(0, jsonMatch.index).trim();
      const details = Object.entries(meta)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${v}`)
        .join("\n");
      return `${prefix}\n${details}`;
    } catch {
      return cleaned;
    }
  }
  return cleaned;
}
import EvidencePanel from "@/components/incidents/EvidencePanel";
import { PageShell } from "@/components/shared/PageShell";
import ErrorState from "@/components/ui/ErrorState";
import SharedEmptyState from "@/components/shared/EmptyState";
import EvidenceExport from "@/components/EvidenceExport";

const priorityColors: Record<string, string> = {
  critical: "text-destructive",
  high: "text-warning",
  medium: "text-info",
  low: "text-muted-foreground",
};
const priorityLabelKeys: Record<string, string> = {
  critical: "incidents.priority_critical",
  high: "incidents.priority_high",
  medium: "incidents.priority_medium",
  low: "incidents.priority_low",
};
const statusLabelKeys: Record<string, string> = {
  open: "incidents.status_open",
  investigating: "incidents.status_investigating",
  in_progress: "incidents.status_in_progress",
  resolved: "incidents.status_resolved",
  closed: "incidents.status_closed",
};
const statusBadgeVariant = (s: string) =>
  s === "open"
    ? ("destructive" as const)
    : s === "resolved" || s === "closed"
      ? ("secondary" as const)
      : ("outline" as const);

export default function IncidentsPage() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    priority: "medium",
    site_id: "",
  });

  const {
    data: rawIncidents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useIncidents();
  const { data: rawSites = [] } = useSites();
  const incidents = rawIncidents as ApiIncident[];
  const sites = rawSites as ApiSite[];
  const queryClient = useQueryClient();

  const filtered = incidents.filter((i: any) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (
      searchTerm &&
      !i.title?.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });
  const selectedInc = selected
    ? incidents.find((i: any) => i.id === selected)
    : null;

  // Stats
  const openCount = incidents.filter((i: any) => i.status === "open").length;
  const investigatingCount = incidents.filter(
    (i: any) => i.status === "investigating" || i.status === "in_progress",
  ).length;
  const resolvedCount = incidents.filter(
    (i: any) => i.status === "resolved" || i.status === "closed",
  ).length;

  useEffect(() => {
    if (!selected && incidents.length > 0) setSelected(incidents[0].id);
  }, [incidents, selected]);

  // ── API Actions (real Fastify endpoints) ───────────────────

  const handleCreate = async () => {
    if (!(newIncident.title || "").trim()) {
      toast.error(t("incidents.title_required"));
      return;
    }
    setActionLoading("create");
    try {
      await apiClient.post("/incidents", {
        title: newIncident.title,
        description: newIncident.description,
        priority: newIncident.priority,
        site_id: newIncident.site_id || undefined,
      });
      toast.success(t("incidents.incident_created"));
      setCreateOpen(false);
      setNewIncident({
        title: "",
        description: "",
        priority: "medium",
        site_id: "",
      });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleComment = async () => {
    if (!selectedInc || !comment.trim()) return;
    setActionLoading("comment");
    try {
      await apiClient.post(`/incidents/${selectedInc.id}/comments`, {
        content: comment,
      });
      toast.success(t("incidents.comment_added"));
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(null);
    }
  };

  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedInc) return;
    // Require confirmation + mandatory text for resolution/closure
    if (newStatus === "resolved" || newStatus === "closed") {
      setPendingStatus(newStatus);
      setResolutionText("");
      setResolutionDialogOpen(true);
      return;
    }
    await executeStatusChange(newStatus);
  };

  const confirmResolution = async () => {
    if (!resolutionText.trim() || !pendingStatus) return;
    setResolutionDialogOpen(false);
    await executeStatusChange(pendingStatus, resolutionText.trim());
    setPendingStatus(null);
    setResolutionText("");
  };

  const executeStatusChange = async (
    newStatus: string,
    resolution?: string,
  ) => {
    if (!selectedInc) return;
    setActionLoading(newStatus);
    try {
      await apiClient.patch(`/incidents/${selectedInc.id}`, {
        status: newStatus,
        ...(resolution ? { resolution } : {}),
      });
      toast.success(
        `${t("incidents.title")} ${t(statusLabelKeys[newStatus]) || newStatus}`,
      );
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAiSummary = async () => {
    if (!selectedInc) return;
    setActionLoading("ai");
    try {
      await apiClient.post("/ai/chat", {
        messages: [
          {
            role: "user",
            content: `Analiza este incidente de seguridad y genera un resumen ejecutivo: "${selectedInc.title}" - ${selectedInc.description || "Sin descripción"}. Prioridad: ${selectedInc.priority}. Estado: ${selectedInc.status}.`,
          },
        ],
      });
      toast.success("Resumen IA solicitado");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(null);
    }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <>
      <PageShell
        title={t("incidents.title") || "Incidentes"}
        description={t("incidents.subtitle")}
        icon={<AlertTriangle className="h-5 w-5" />}
        actions={
          <>
            <EvidenceExport incidents={incidents as any} />
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-3 w-3" /> {t("common.new")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("incidents.create_incident")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>{t("incidents.title_label")}</Label>
                    <Input
                      value={newIncident.title}
                      onChange={(e) =>
                        setNewIncident((p) => ({ ...p, title: e.target.value }))
                      }
                      placeholder={t("incidents.title_placeholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("incidents.description_label")}</Label>
                    <Textarea
                      value={newIncident.description}
                      onChange={(e) =>
                        setNewIncident((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      placeholder={t("incidents.description_placeholder")}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("incidents.priority")}</Label>
                      <Select
                        value={newIncident.priority}
                        onValueChange={(v) =>
                          setNewIncident((p) => ({ ...p, priority: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">
                            {t("incidents.priority_critical")}
                          </SelectItem>
                          <SelectItem value="high">
                            {t("incidents.priority_high")}
                          </SelectItem>
                          <SelectItem value="medium">
                            {t("incidents.priority_medium")}
                          </SelectItem>
                          <SelectItem value="low">
                            {t("incidents.priority_low")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("incidents.site")}</Label>
                      <Select
                        value={newIncident.site_id}
                        onValueChange={(v) =>
                          setNewIncident((p) => ({ ...p, site_id: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("incidents.select_site")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {sites.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreate}
                    disabled={actionLoading === "create"}
                  >
                    {actionLoading === "create" ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-4 w-4" />
                    )}
                    {t("incidents.create_incident")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      >
        <div className="flex flex-col md:flex-row h-full">
          {/* Left panel — incident list */}
          <div
            className={cn(
              "w-full md:w-80 border-r flex flex-col",
              selected && "hidden md:flex",
            )}
          >
            {/* Stats bar */}
            <div className="px-3 py-2 border-b flex items-center gap-2 text-xs">
              <Badge variant="destructive" className="text-[10px]">
                {openCount} {t("incidents.status_open_count")}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {investigatingCount} {t("incidents.status_in_progress_count")}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {resolvedCount} {t("incidents.status_resolved_count")}
              </Badge>
            </div>

            {/* Search + filter */}
            <div className="px-3 py-2 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder={t("incidents.search")}
                  className="pl-7 h-7 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter className="h-3 w-3 text-muted-foreground" />
                {["all", "open", "investigating", "resolved", "closed"].map(
                  (s) => (
                    <Button
                      key={s}
                      variant={statusFilter === s ? "default" : "ghost"}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setStatusFilter(s)}
                    >
                      {s === "all"
                        ? t("common.all")
                        : t(statusLabelKeys[s]) || s}
                    </Button>
                  ),
                )}
              </div>
            </div>

            {/* Incident list */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="p-3 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <SharedEmptyState
                  icon={AlertCircle}
                  title={t("incidents.no_incidents")}
                  description={t("incidents.no_incidents_desc")}
                  actionLabel={t("incidents.create_incident")}
                  onAction={() => setCreateOpen(true)}
                />
              ) : (
                filtered.map((inc: any) => (
                  <button
                    key={inc.id}
                    className={cn(
                      "w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors",
                      selected === inc.id && "bg-muted/50",
                    )}
                    onClick={() => setSelected(inc.id)}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4 mt-0.5 shrink-0",
                          priorityColors[inc.priority] ||
                            "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {inc.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={statusBadgeVariant(inc.status)}
                            className="text-[9px]"
                          >
                            {t(statusLabelKeys[inc.status]) || inc.status}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">
                            {t(priorityLabelKeys[inc.priority]) || inc.priority}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDateTime(inc.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel — incident detail */}
          {selectedInc ? (
            <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
              <button
                onClick={() => setSelected(null)}
                className="md:hidden text-xs text-muted-foreground mb-2 flex items-center gap-1 hover:text-foreground"
              >
                &larr; {t("common.back")}
              </button>
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={statusBadgeVariant(selectedInc.status)}>
                      {t(statusLabelKeys[selectedInc.status]) ||
                        selectedInc.status}
                    </Badge>
                    <Badge
                      className={cn(
                        "text-xs",
                        selectedInc.priority === "critical"
                          ? "bg-destructive"
                          : "",
                      )}
                    >
                      {t(priorityLabelKeys[selectedInc.priority]) ||
                        selectedInc.priority}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold">{selectedInc.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                    {formatIncidentDescription(selectedInc.description)}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAiSummary}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === "ai" ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Bot className="mr-1 h-3 w-3" />
                    )}{" "}
                    {t("incidents.ai_summary")}
                  </Button>
                  {selectedInc.status !== "closed" &&
                    selectedInc.status !== "resolved" && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStatusChange("resolved")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === "resolved" ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          )}{" "}
                          {t("incidents.resolve")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleStatusChange("closed")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === "closed" ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="mr-1 h-3 w-3" />
                          )}{" "}
                          {t("incidents.close")}
                        </Button>
                      </>
                    )}
                </div>
              </div>

              {selectedInc.ai_summary && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1">
                      <Bot className="h-3 w-3" /> {t("incidents.ai_summary")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedInc.ai_summary}</p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-3 space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">
                      {t("incidents.assigned_to")}
                    </p>
                    <p className="font-medium flex items-center gap-1">
                      <User className="h-3 w-3" />{" "}
                      {selectedInc.assigned_to
                        ? t("incidents.operator")
                        : t("incidents.unassigned")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">
                      {t("incidents.related_events")}
                    </p>
                    <p className="font-medium">
                      {selectedInc.event_ids?.length || 0}{" "}
                      {t("incidents.events_count")}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">
                      {t("incidents.created")}
                    </p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />{" "}
                      {formatDateTime(selectedInc.created_at)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="activity" className="w-full">
                <TabsList>
                  <TabsTrigger
                    value="activity"
                    className="flex items-center gap-1"
                  >
                    <MessageSquare className="h-3 w-3" />{" "}
                    {t("incidents.activity_tab")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="evidence"
                    className="flex items-center gap-1"
                  >
                    <Shield className="h-3 w-3" /> {t("incidents.evidence_tab")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="activity">
                  <Card>
                    <CardContent className="space-y-3 pt-4">
                      {Array.isArray(selectedInc.comments) &&
                        (selectedInc.comments as Record<string, unknown>[]).map(
                          (c, idx) => (
                            <div key={c.id || idx} className="flex gap-3">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold shrink-0">
                                {(c.user_name || "U")
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {c.user_name || "Usuario"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDateTime(c.created_at)}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {sanitizeText(c.content)}
                                </p>
                              </div>
                            </div>
                          ),
                        )}
                      {selectedInc.status !== "closed" && (
                        <>
                          <Textarea
                            placeholder={t("incidents.add_comment")}
                            className="text-sm min-h-[60px]"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleComment}
                              disabled={
                                !comment.trim() || actionLoading === "comment"
                              }
                            >
                              {actionLoading === "comment" ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <MessageSquare className="mr-1 h-3 w-3" />
                              )}{" "}
                              {t("incidents.comment")}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="evidence">
                  <EvidencePanel
                    incidentId={selectedInc.id}
                    incidentStatus={selectedInc.status}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>{t("incidents.select_incident")}</p>
            </div>
          )}
        </div>
      </PageShell>

      {/* Resolution confirmation dialog */}
      {resolutionDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">
              {pendingStatus === "resolved"
                ? t("incidents.resolve_incident")
                : t("incidents.close_incident")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("incidents.resolution_required")}
            </p>
            <textarea
              className="w-full border rounded-md p-3 text-sm min-h-[100px] bg-background resize-none focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder={t("incidents.resolution_placeholder")}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
                onClick={() => {
                  setResolutionDialogOpen(false);
                  setPendingStatus(null);
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                onClick={confirmResolution}
                disabled={!resolutionText.trim()}
              >
                {pendingStatus === "resolved"
                  ? t("incidents.confirm_resolution")
                  : t("incidents.confirm_close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
