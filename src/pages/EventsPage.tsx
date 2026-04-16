import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useEvents,
  useDevices,
  useSites,
  type EventFilters,
} from "@/hooks/use-api-data";
import type { ApiEvent, ApiDevice, ApiSite } from "@/types/api-entities";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { useAudioAlerts } from "@/hooks/use-audio-alerts";
import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";
import {
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Bot,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Loader2,
  Download,
  Radio,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date-utils";
import EventFiltersBar from "@/components/events/EventFiltersBar";
import EventDetailPanel from "@/components/events/EventDetailPanel";
import { PageShell } from "@/components/shared/PageShell";
import ErrorState from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/SkeletonVariants";

const severityConfig: Record<string, { icon: React.ReactNode; color: string }> =
  {
    critical: {
      icon: <XCircle className="h-4 w-4" />,
      color: "text-destructive",
    },
    high: {
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "text-warning",
    },
    medium: { icon: <AlertCircle className="h-4 w-4" />, color: "text-info" },
    low: { icon: <Info className="h-4 w-4" />, color: "text-muted-foreground" },
    info: {
      icon: <Info className="h-4 w-4" />,
      color: "text-muted-foreground",
    },
  };

const PAGE_SIZE = 25;

const defaultFilters: EventFilters = {
  search: "",
  severity: "all",
  status: "all",
  device_id: "all",
  site_id: "all",
  date_from: undefined,
  date_to: undefined,
  page: 1,
  pageSize: PAGE_SIZE,
};

export default function EventsPage() {
  const { t } = useI18n();
  const [filters, setFilters] = useState<EventFilters>(defaultFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Audio alerts
  const { playAlert, isMuted, toggleMute } = useAudioAlerts();
  const prevEventCountRef = useRef<number | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<{
    action: string;
    done: number;
    total: number;
  } | null>(null);

  const {
    data: result,
    isLoading,
    isError,
    error,
    refetch,
  } = useEvents(filters);
  const events = (result?.data ?? []) as ApiEvent[];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: rawDevices = [] } = useDevices();
  const { data: rawSites = [] } = useSites();
  const devices = rawDevices as ApiDevice[];
  const sites = rawSites as ApiSite[];
  const queryClient = useQueryClient();
  useRealtimeEvents();

  // Play audio alert when new events arrive
  useEffect(() => {
    if (prevEventCountRef.current !== null && events.length > 0) {
      const prevCount = prevEventCountRef.current;
      if (totalCount > prevCount && events[0]) {
        const severity = String(events[0].severity ?? "info") as
          | "critical"
          | "high"
          | "medium"
          | "low"
          | "info";
        playAlert(severity);
      }
    }
    prevEventCountRef.current = totalCount;
  }, [totalCount, events, playAlert]);

  // Toggle single row selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select all / deselect all on current page
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allOnPage = events.map((e) => e.id as string);
      const allSelected = allOnPage.every((id) => prev.has(id));
      if (allSelected) return new Set<string>();
      return new Set<string>(allOnPage);
    });
  }, [events]);

  // Bulk action handler
  const handleBulkAction = useCallback(
    async (action: "acknowledge" | "resolve" | "dismiss") => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      setBulkLoading({ action, done: 0, total: ids.length });

      let successCount = 0;
      for (let i = 0; i < ids.length; i++) {
        try {
          await apiClient.patch(`/events/${ids[i]}`, {
            status:
              action === "acknowledge"
                ? "acknowledged"
                : action === "resolve"
                  ? "resolved"
                  : "dismissed",
          });
          successCount++;
        } catch {
          /* continue with remaining */
        }
        setBulkLoading({ action, done: i + 1, total: ids.length });
      }

      queryClient.invalidateQueries({ queryKey: ["events"] });
      setSelectedIds(new Set());
      setBulkLoading(null);
      toast.success(`${successCount}/${ids.length} eventos procesados`);
    },
    [selectedIds, queryClient],
  );

  const updateFilters = useCallback((partial: Partial<EventFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);
  const resetFilters = useCallback(() => setFilters(defaultFilters), []);
  const selectedEvent = selected ? events.find((e) => e.id === selected) : null;

  const handleAction = async (eventId: string, action: string) => {
    setActionLoading(action);
    try {
      switch (action) {
        case "acknowledge":
          await apiClient.patch(`/events/${eventId}`, {
            status: "acknowledged",
          });
          toast.success(t("events.acknowledged"));
          break;
        case "resolve":
          await apiClient.patch(`/events/${eventId}`, { status: "resolved" });
          toast.success(t("events.resolved"));
          break;
        case "dismiss":
          await apiClient.patch(`/events/${eventId}`, { status: "dismissed" });
          toast.success(t("events.dismissed"));
          break;
        case "ai-summary":
          await apiClient.post("/ai/chat", {
            messages: [
              {
                role: "user",
                content: `Analiza este evento de seguridad y dame un resumen: ID ${eventId}`,
              },
            ],
          });
          toast.success(t("events.ai_summary"));
          break;
        case "create-incident": {
          const event = events.find((e: any) => e.id === eventId);
          if (event) {
            await apiClient.post("/incidents", {
              title: `Incidente: ${event.title}`,
              description: `Creado desde evento: ${event.description || event.title}`,
              priority:
                event.severity === "critical"
                  ? "critical"
                  : event.severity === "high"
                    ? "high"
                    : "medium",
              site_id: event.site_id,
              event_ids: [eventId],
            });
            toast.success(t("events.create_incident"));
          }
          break;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setActionLoading(null);
    }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title={t("events.title")}
      description={t("events.subtitle")}
      icon={<AlertTriangle className="h-5 w-5" />}
      badge={
        <Badge variant="destructive" className="text-xs">
          {totalCount} total
        </Badge>
      }
    >
      <div className="flex flex-col lg:flex-row h-full">
        <div
          className={cn(
            "flex-1 flex flex-col",
            selectedEvent && "lg:max-w-[60%] hidden lg:flex",
          )}
        >
          <EventFiltersBar
            filters={filters}
            onChange={updateFilters}
            onReset={resetFilters}
            devices={devices}
            sites={sites}
            newCount={totalCount}
          />

          {/* Sound toggle + Bulk actions bar */}
          <div className="px-4 py-1.5 border-b flex items-center gap-2">
            {/* Realtime indicator */}
            <div className="flex items-center gap-1.5 text-[10px] text-green-500">
              <Radio className="h-3 w-3 animate-pulse" />
              <span className="font-medium">Tiempo real</span>
            </div>

            <div className="w-px h-5 bg-border mx-1" />

            <Button
              variant={isMuted ? "outline" : "default"}
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={toggleMute}
              aria-label={isMuted ? "Activar sonido" : "Silenciar"}
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              {isMuted ? t("events.sound_off") : t("events.sound_on")}
            </Button>

            {/* CSV Export */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                const csv = [
                  [
                    "Fecha",
                    "Tipo",
                    "Severidad",
                    "Título",
                    "Estado",
                    "Dispositivo",
                    "Sitio",
                  ].join(","),
                  ...events.map((e) =>
                    [
                      formatDateTime(e.created_at),
                      String(e.event_type ?? "").replace(/_/g, " "),
                      String(e.severity ?? ""),
                      `"${String(e.title ?? "").replace(/"/g, '""')}"`,
                      String(e.status ?? ""),
                      String(
                        devices.find((d) => d.id === e.device_id)?.name ?? "",
                      ),
                      String(sites.find((s) => s.id === e.site_id)?.name ?? ""),
                    ].join(","),
                  ),
                ].join("\n");
                const blob = new Blob(["\uFEFF" + csv], {
                  type: "text/csv;charset=utf-8;",
                });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `eventos-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                toast.success(`${events.length} eventos exportados a CSV`);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>

            {selectedIds.size > 0 && (
              <>
                <div className="w-px h-5 bg-border mx-1" />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size} seleccionados
                </span>

                {bulkLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Procesando {bulkLoading.done}/{bulkLoading.total}...
                  </div>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleBulkAction("acknowledge")}
                    >
                      Reconocer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleBulkAction("resolve")}
                    >
                      Resolver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleBulkAction("dismiss")}
                    >
                      Descartar
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-4">
                <SkeletonTable rows={8} />
              </div>
            ) : events.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-12 w-12" />}
                title={t("events.no_events") || "No hay eventos"}
                description="Los eventos aparecerán aquí cuando se detecten"
              />
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-2 p-3">
                  {events.map((event) => {
                    const sev =
                      severityConfig[event.severity ?? "info"] ||
                      severityConfig.info;
                    const device = devices.find(
                      (d) => d.id === event.device_id,
                    );
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "bg-card rounded-lg p-3 border cursor-pointer transition-colors hover:bg-muted/50",
                          selected === event.id && "ring-1 ring-primary",
                        )}
                        onClick={() => setSelected(event.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={sev.color}>{sev.icon}</span>
                            <Badge
                              variant={
                                event.status === "new"
                                  ? "destructive"
                                  : event.status === "resolved"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-[10px] capitalize"
                            >
                              {event.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(event.created_at)}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-1.5">
                          {event.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate capitalize">
                          {(event.event_type || "unknown").replace(/_/g, " ")}
                          {device ? ` — ${device.name}` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block">
                  <Table aria-label="Events list">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 px-2">
                          <Checkbox
                            checked={
                              events.length > 0 &&
                              events.every((e) => selectedIds.has(e.id))
                            }
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>{t("events.event")}</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          {t("events.device")}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t("events.site")}
                        </TableHead>
                        <TableHead>{t("events.time")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => {
                        const sev =
                          severityConfig[event.severity ?? "info"] ||
                          severityConfig.info;
                        const device = devices.find(
                          (d) => d.id === event.device_id,
                        );
                        const site = sites.find((s) => s.id === event.site_id);
                        return (
                          <TableRow
                            key={event.id}
                            className={cn(
                              "cursor-pointer",
                              selected === event.id && "bg-muted/50",
                              selectedIds.has(event.id) && "bg-primary/5",
                            )}
                            onClick={() => setSelected(event.id)}
                          >
                            <TableCell
                              className="px-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={selectedIds.has(event.id)}
                                onCheckedChange={() => toggleSelect(event.id)}
                                aria-label={`Select ${event.title}`}
                              />
                            </TableCell>
                            <TableCell>
                              <span className={sev.color}>{sev.icon}</span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">
                                  {event.title}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {(event.event_type || "unknown").replace(
                                    /_/g,
                                    " ",
                                  )}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs">
                              {String(event.device_name ?? device?.name ?? "—")}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs">
                              {String(event.site_name ?? site?.name ?? "—")
                                .split("—")[0]
                                ?.trim()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(event.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  event.status === "new"
                                    ? "destructive"
                                    : event.status === "resolved"
                                      ? "secondary"
                                      : "outline"
                                }
                                className="text-[10px] capitalize"
                              >
                                {event.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Event actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction(event.id, "acknowledge")
                                    }
                                    disabled={event.status !== "new"}
                                  >
                                    <CheckCircle2 className="mr-2 h-3 w-3" />{" "}
                                    {t("events.acknowledge")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction(event.id, "resolve")
                                    }
                                  >
                                    <CheckCircle2 className="mr-2 h-3 w-3" />{" "}
                                    {t("events.resolve")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction(event.id, "ai-summary")
                                    }
                                  >
                                    <Bot className="mr-2 h-3 w-3" />{" "}
                                    {t("events.ai_summary")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction(event.id, "create-incident")
                                    }
                                  >
                                    <AlertTriangle className="mr-2 h-3 w-3" />{" "}
                                    {t("events.create_incident")}
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
              </>
            )}
          </div>
          <div className="px-4 py-2 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {totalCount} {t("events.count")} · {t("events.page")}{" "}
              {filters.page} {t("events.of")} {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => updateFilters({ page: (filters.page ?? 1) - 1 })}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const current = filters.page ?? 1;
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (current <= 3) pageNum = i + 1;
                else if (current >= totalPages - 2)
                  pageNum = totalPages - 4 + i;
                else pageNum = current - 2 + i;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === current ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => updateFilters({ page: pageNum })}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={(filters.page ?? 1) >= totalPages}
                onClick={() => updateFilters({ page: (filters.page ?? 1) + 1 })}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {selectedEvent && (
          <div className="fixed inset-0 z-40 bg-background lg:static lg:z-auto lg:flex-1 overflow-auto">
            <button
              onClick={() => setSelected(null)}
              className="lg:hidden text-xs text-muted-foreground p-4 pb-0 flex items-center gap-1 hover:text-foreground"
            >
              &larr; {t("common.back") || "Back"}
            </button>
            <EventDetailPanel
              event={selectedEvent}
              devices={devices}
              sites={sites}
              actionLoading={actionLoading}
              onAction={handleAction}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
