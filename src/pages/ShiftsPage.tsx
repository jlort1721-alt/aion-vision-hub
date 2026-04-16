import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, shiftAssignmentsApi } from "@/services/shifts-api";
import { apiClient } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock, Users, CalendarCheck, UserCheck, Plus, Loader2, CalendarDays,
  AlertTriangle, ChevronLeft, ChevronRight, Pencil, Trash2, LogIn, LogOut
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/PageShell";
import ErrorState from "@/components/ui/ErrorState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  checked_in: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  checked_out: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  missed: "bg-red-500/10 text-red-400 border-red-500/30",
  excused: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  checked_in: "En turno",
  checked_out: "Finalizado",
  missed: "Ausente",
  excused: "Excusado",
};

// Days: index 0-6 = Mon-Sun (for UI), backend expects 0=Sun...6=Sat ISO week
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
// Map UI index (0=Mon) to ISO day number (0=Sun, 1=Mon, ...6=Sat)
const UI_TO_ISO = [1, 2, 3, 4, 5, 6, 0]; // Mon=1, Tue=2, ..., Sun=0
const ISO_TO_UI = [6, 0, 1, 2, 3, 4, 5]; // Sun→6, Mon→0, ...

const SHIFT_BLOCKS = [
  { label: 'Mañana (06:00-14:00)', start: 6, end: 14 },
  { label: 'Tarde (14:00-22:00)', start: 14, end: 22 },
  { label: 'Noche (22:00-06:00)', start: 22, end: 6 },
];

const GUARD_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-400',
];

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function parseHour(t: string): number {
  return parseInt((t || '0').split(':')[0], 10);
}

function shiftMatchesBlock(startTime: string, endTime: string, block: typeof SHIFT_BLOCKS[number]): boolean {
  const sh = parseHour(startTime);
  if (block.start === 22) return sh >= 22 || sh < 6;
  return sh >= block.start && sh < block.end;
}

// Convert ISO day numbers [0=Sun...6=Sat] to UI display string
function daysToDisplay(daysOfWeek: number[] | string[] | undefined): string {
  if (!daysOfWeek || daysOfWeek.length === 0) return 'Sin definir';
  // Handle both number[] (correct) and string[] (legacy)
  const nums = daysOfWeek.map(d => typeof d === 'number' ? d : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(d));
  return nums.map(n => DAY_NAMES[ISO_TO_UI[n]] || '?').join(', ');
}

// ══════════════════════════════════════════════════════════════
// Default forms
// ══════════════════════════════════════════════════════════════

const defaultShift = {
  name: '',
  startTime: '06:00',
  endTime: '14:00',
  // Store as UI indexes (0=Mon...6=Sun), convert on submit
  selectedDays: [0, 1, 2, 3, 4] as number[], // Mon-Fri
  maxGuards: 1,
};

const defaultAssignment = { shiftId: '', userId: '', date: new Date().toISOString().slice(0, 10) };

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function ShiftsPage() {
  const [activeTab, setActiveTab] = useState("shifts");
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newShift, setNewShift] = useState(defaultShift);
  const [newAssignment, setNewAssignment] = useState(defaultAssignment);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarDetail, setCalendarDetail] = useState<{ dayIndex: number; blockIndex: number } | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch users
  const { data: usersData } = useQuery({
    queryKey: ['users-for-shifts'],
    queryFn: () => apiClient.get<any>('/users'),
  });
  const usersList = useMemo(() => {
    if (!usersData) return [];
    if (Array.isArray(usersData)) return usersData;
    if (usersData?.items) return usersData.items;
    return [];
  }, [usersData]);

  // ── Shifts CRUD ──
  const { data: shiftsData, isLoading: loadingShifts, isError: shiftsError, error: shiftsErrorObj, refetch: refetchShifts } = useQuery({
    queryKey: ["shifts", "list"],
    queryFn: () => shiftsApi.list(),
  });

  const createShiftMut = useMutation({
    mutationFn: (data: typeof defaultShift) => {
      // Convert UI day indexes to ISO numbers before sending
      const daysOfWeek = data.selectedDays.map(i => UI_TO_ISO[i]);
      return shiftsApi.create({ name: data.name, startTime: data.startTime, endTime: data.endTime, daysOfWeek, maxGuards: data.maxGuards });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Turno creado'); setShowCreateShift(false); setNewShift(defaultShift); setEditingShiftId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateShiftMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof defaultShift }) => {
      const daysOfWeek = data.selectedDays.map(i => UI_TO_ISO[i]);
      return shiftsApi.update(id, { name: data.name, startTime: data.startTime, endTime: data.endTime, daysOfWeek, maxGuards: data.maxGuards });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Turno actualizado'); setShowCreateShift(false); setEditingShiftId(null); setNewShift(defaultShift); },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleShiftMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => shiftsApi.update(id, { isActive }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); toast.success("Turno actualizado"); },
  });

  const deleteShiftMut = useMutation({
    mutationFn: (id: string) => shiftsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Turno eliminado'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Assignments ──
  const { data: assignmentsData, isLoading: loadingAssignments } = useQuery({
    queryKey: ["shifts", "assignments"],
    queryFn: () => shiftAssignmentsApi.list(),
  });

  const { data: statsData } = useQuery({
    queryKey: ["shifts", "stats"],
    queryFn: () => shiftAssignmentsApi.stats(),
    refetchInterval: 30000,
  });

  const createAssignmentMut = useMutation({
    mutationFn: (data: typeof defaultAssignment) => shiftAssignmentsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Asignación creada'); setShowCreateAssignment(false); setNewAssignment(defaultAssignment); },
    onError: (err: Error) => toast.error(err.message),
  });

  // Fix: use correct field names checkInAt/checkOutAt (not checkInTime/checkOutTime)
  const checkInMut = useMutation({
    mutationFn: (id: string) => shiftAssignmentsApi.update(id, { status: "checked_in", checkInAt: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); toast.success("Entrada registrada"); },
  });

  const checkOutMut = useMutation({
    mutationFn: (id: string) => shiftAssignmentsApi.update(id, { status: "checked_out", checkOutAt: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); toast.success("Salida registrada"); },
  });

  // ── Parsed data (cast to any[] to avoid narrow Record<string,unknown> types) ──
  const shiftsEnvelope = shiftsData as Record<string, unknown> | unknown[] | undefined;
  const shiftsRaw = (!Array.isArray(shiftsEnvelope) && shiftsEnvelope ? shiftsEnvelope.data : shiftsEnvelope) ?? [];
  const shiftsList: Record<string, unknown>[] = Array.isArray(shiftsRaw) ? shiftsRaw as Record<string, unknown>[] : [];
  const assignmentsEnvelope = assignmentsData as Record<string, unknown> | unknown[] | undefined;
  const assignmentsRaw = (!Array.isArray(assignmentsEnvelope) && assignmentsEnvelope ? (assignmentsEnvelope.data ?? assignmentsEnvelope.items) : assignmentsEnvelope) ?? [];
  const assignmentsList: Record<string, unknown>[] = Array.isArray(assignmentsRaw) ? assignmentsRaw as Record<string, unknown>[] : [];
  const statsEnvelope = statsData as Record<string, unknown> | undefined;
  const rawStats: Record<string, unknown> | undefined = (statsEnvelope?.data as Record<string, unknown> | undefined) ?? statsEnvelope;

  // Fix: handle nested stats format { total, byStatus: { scheduled, checked_in, ... } }
  const stats = useMemo(() => ({
    scheduled: rawStats?.byStatus?.scheduled ?? rawStats?.totalScheduled ?? rawStats?.scheduled ?? 0,
    checkedIn: rawStats?.byStatus?.checked_in ?? rawStats?.checkedIn ?? 0,
    missed: rawStats?.byStatus?.missed ?? rawStats?.missed ?? 0,
    excused: rawStats?.byStatus?.excused ?? rawStats?.excused ?? 0,
  }), [rawStats]);

  // ── Calendar logic ──
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const guardColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const a of assignmentsList) {
      const key = a.userName || a.userId;
      if (key && !map.has(key as string)) {
        map.set(key as string, GUARD_COLORS[idx % GUARD_COLORS.length]);
        idx++;
      }
    }
    return map;
  }, [assignmentsList]);

  const calendarData = useMemo(() => {
    const grid: { guards: { name: string; assignmentId: string; status: string }[]; hasConflict: boolean }[][] =
      Array.from({ length: 7 }, () => Array.from({ length: 3 }, () => ({ guards: [], hasConflict: false })));
    const dayGuardBlocks: Map<string, Set<number>>[] = Array.from({ length: 7 }, () => new Map());

    for (const assignment of assignmentsList) {
      if (!assignment.date) continue;
      const aDate = new Date(assignment.date);
      aDate.setHours(0, 0, 0, 0);
      const dayIdx = weekDates.findIndex(d => d.getTime() === aDate.getTime());
      if (dayIdx === -1) continue;

      const shift = shiftsList.find((s: any) => s.id === assignment.shiftId);
      const startTime = shift?.startTime || assignment.startTime || '06:00';
      const endTime = shift?.endTime || assignment.endTime || '14:00';
      const guardName = (assignment.userName || assignment.userEmail || assignment.userId || 'Desconocido') as string;

      for (let bi = 0; bi < SHIFT_BLOCKS.length; bi++) {
        if (shiftMatchesBlock(startTime, endTime, SHIFT_BLOCKS[bi])) {
          grid[dayIdx][bi].guards.push({ name: guardName, assignmentId: assignment.id as string, status: assignment.status as string });
          if (!dayGuardBlocks[dayIdx].has(guardName)) dayGuardBlocks[dayIdx].set(guardName, new Set());
          dayGuardBlocks[dayIdx].get(guardName)!.add(bi);
        }
      }
    }

    for (let di = 0; di < 7; di++) {
      for (const [, blocks] of dayGuardBlocks[di]) {
        if (blocks.size > 1) { for (const bi of blocks) grid[di][bi].hasConflict = true; }
      }
    }
    return grid;
  }, [assignmentsList, shiftsList, weekDates]);

  const weekLabel = weekDates.length >= 7
    ? `${weekDates[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${weekDates[6].toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  // ── Edit shift handler ──
  const openEditShift = (shift: any) => {
    const isoDays: number[] = shift.daysOfWeek || [];
    const uiDays = isoDays.map((d: number) => ISO_TO_UI[d]).filter((d: number) => d !== undefined);
    setEditingShiftId(shift.id);
    setNewShift({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime, selectedDays: uiDays, maxGuards: shift.maxGuards ?? 1 });
    setShowCreateShift(true);
  };

  const handleSaveShift = () => {
    if (!newShift.name.trim()) return;
    if (editingShiftId) {
      updateShiftMut.mutate({ id: editingShiftId, data: newShift });
    } else {
      createShiftMut.mutate(newShift);
    }
  };

  if (shiftsError) return <ErrorState error={shiftsErrorObj as Error} onRetry={refetchShifts} />;

  return (
    <PageShell
      title="Gestión de Turnos"
      description="Administra turnos de guardias y controla asistencia"
      icon={<Clock className="h-5 w-5" />}
    >
      <div className="space-y-5 p-5">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<CalendarCheck className="h-5 w-5 text-blue-400" />} label="Programados" value={stats.scheduled} color="text-blue-400" />
        <StatCard icon={<UserCheck className="h-5 w-5 text-emerald-400" />} label="En turno" value={stats.checkedIn} color="text-emerald-400" />
        <StatCard icon={<Clock className="h-5 w-5 text-red-400" />} label="Ausentes" value={stats.missed} color="text-red-400" />
        <StatCard icon={<Users className="h-5 w-5 text-amber-400" />} label="Excusados" value={stats.excused} color="text-amber-400" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="shifts" className="gap-1 text-xs"><Clock className="h-3.5 w-3.5" /> Turnos</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1 text-xs"><Users className="h-3.5 w-3.5" /> Asignaciones</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1 text-xs"><CalendarDays className="h-3.5 w-3.5" /> Calendario</TabsTrigger>
        </TabsList>

        {/* ═══ Shifts Tab ═══ */}
        <TabsContent value="shifts" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1.5" onClick={() => { setEditingShiftId(null); setNewShift(defaultShift); setShowCreateShift(true); }}>
              <Plus className="h-4 w-4" /> Nuevo Turno
            </Button>
          </div>

          {loadingShifts ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : shiftsList.length === 0 ? (
            <EmptyState icon={<Clock />} title="Sin turnos configurados" desc="Crea tu primer turno para comenzar" action={<Button size="sm" onClick={() => setShowCreateShift(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Crear turno</Button>} />
          ) : (
            <div className="space-y-3">
              {shiftsList.map((shift: any) => (
                <Card key={shift.id} className={cn("bg-slate-800/40 border-slate-700/50 transition-opacity", !shift.isActive && "opacity-50")}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className={cn("h-5 w-5", shift.isActive ? "text-blue-400" : "text-slate-600")} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{shift.name}</h3>
                            <Badge variant="outline" className="text-[10px] font-mono">{shift.startTime} - {shift.endTime}</Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {daysToDisplay(shift.daysOfWeek)} &bull; Máx: {shift.maxGuards ?? 'N/A'} guardias
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => openEditShift(shift)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => { if (confirm('¿Eliminar este turno?')) deleteShiftMut.mutate(shift.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        <Switch checked={shift.isActive} onCheckedChange={checked => toggleShiftMut.mutate({ id: shift.id, isActive: checked })} className="h-4 w-8" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Assignments Tab ═══ */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1.5" onClick={() => setShowCreateAssignment(true)}>
              <Plus className="h-4 w-4" /> Nueva Asignación
            </Button>
          </div>

          {loadingAssignments ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : assignmentsList.length === 0 ? (
            <EmptyState icon={<Users />} title="Sin asignaciones" desc="Asigna guardias a turnos para controlar asistencia" action={<Button size="sm" onClick={() => setShowCreateAssignment(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Asignar</Button>} />
          ) : (
            <div className="space-y-3">
              {assignmentsList.map((a: any) => {
                const statusCfg = STATUS_COLORS[a.status] || STATUS_COLORS.scheduled;
                const statusLabel = STATUS_LABELS[a.status] || a.status;
                const shift = shiftsList.find((s: any) => s.id === a.shiftId);
                return (
                  <Card key={a.id} className="bg-slate-800/40 border-slate-700/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <UserCheck className={cn("h-5 w-5 mt-0.5", a.status === 'checked_in' ? "text-emerald-400" : "text-slate-500")} />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-white">{a.userName || a.userEmail || a.userId}</h3>
                              <Badge className={cn("text-[9px] border", statusCfg)}>{statusLabel}</Badge>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {a.date ? new Date(a.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                              {(a.shiftName || shift?.name) && ` \u2022 ${a.shiftName || shift?.name}`}
                              {(a.startTime || shift?.startTime) && ` (${a.startTime || shift?.startTime} - ${a.endTime || shift?.endTime})`}
                            </p>
                            {/* Fix: use checkInAt/checkOutAt (correct field names) */}
                            {(a.checkInAt || a.checkOutAt) && (
                              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-3">
                                {a.checkInAt && <span className="flex items-center gap-1"><LogIn className="h-3 w-3 text-emerald-400" /> {new Date(a.checkInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                                {a.checkOutAt && <span className="flex items-center gap-1"><LogOut className="h-3 w-3 text-slate-400" /> {new Date(a.checkOutAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {a.status === 'scheduled' && (
                            <Button size="sm" onClick={() => checkInMut.mutate(a.id)} disabled={checkInMut.isPending} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                              <LogIn className="h-3.5 w-3.5" /> Entrada
                            </Button>
                          )}
                          {a.status === 'checked_in' && (
                            <Button size="sm" variant="outline" onClick={() => checkOutMut.mutate(a.id)} disabled={checkOutMut.isPending} className="gap-1">
                              <LogOut className="h-3.5 w-3.5" /> Salida
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ Calendar Tab ═══ */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium min-w-[200px] text-center text-white">{weekLabel}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight className="h-4 w-4" /></Button>
              {weekOffset !== 0 && <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Hoy</Button>}
            </div>
          </div>

          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardContent className="p-0 overflow-x-auto">
              <div className="grid min-w-[700px]" style={{ gridTemplateColumns: '130px repeat(7, 1fr)', gridTemplateRows: 'auto repeat(3, 1fr)' }}>
                {/* Header */}
                <div className="p-2 border-b border-r border-slate-700/50 bg-slate-800/50 font-medium text-xs text-slate-500" />
                {DAY_NAMES.map((d, di) => (
                  <div key={di} className={cn("p-2 border-b border-slate-700/50 bg-slate-800/50 text-center", weekDates[di]?.toDateString() === new Date().toDateString() && "bg-blue-500/10")}>
                    <div className="font-medium text-xs text-white">{d}</div>
                    <div className="text-[10px] text-slate-500">{weekDates[di]?.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</div>
                  </div>
                ))}

                {/* Blocks */}
                {SHIFT_BLOCKS.map((block, bi) => (
                  <div key={`block-${bi}`} className="contents">
                    <div className="p-2 border-b border-r border-slate-700/50 bg-slate-800/30 flex items-center">
                      <span className="text-[10px] font-medium text-slate-400">{block.label}</span>
                    </div>
                    {DAY_NAMES.map((_, di) => {
                      const cell = calendarData[di]?.[bi];
                      const guards = cell?.guards ?? [];
                      return (
                        <div
                          key={`cell-${di}-${bi}`}
                          className="p-1.5 border-b border-slate-700/30 min-h-[65px] cursor-pointer hover:bg-slate-800/40 transition-colors relative"
                          onClick={() => setCalendarDetail({ dayIndex: di, blockIndex: bi })}
                        >
                          {cell?.hasConflict && <AlertTriangle className="absolute top-1 right-1 h-3 w-3 text-red-400" title="Conflicto" />}
                          <div className="flex flex-wrap gap-1">
                            {guards.map((g, gi) => (
                              <Badge key={gi} className={cn("text-[9px] px-1.5 py-0 text-white", guardColorMap.get(g.name) || 'bg-slate-600')}>
                                {g.name.length > 10 ? g.name.slice(0, 10) + '…' : g.name}
                              </Badge>
                            ))}
                            {guards.length === 0 && <span className="text-[9px] text-slate-600 italic">Sin asignar</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ Create/Edit Shift Dialog ═══ */}
      <Dialog open={showCreateShift} onOpenChange={o => { if (!o) { setShowCreateShift(false); setEditingShiftId(null); } else setShowCreateShift(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingShiftId ? 'Editar Turno' : 'Nuevo Turno'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Nombre *</Label><Input value={newShift.name} onChange={e => setNewShift(s => ({ ...s, name: e.target.value }))} placeholder="Turno mañana" className="bg-slate-900 border-slate-700" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Hora inicio</Label><Input type="time" value={newShift.startTime} onChange={e => setNewShift(s => ({ ...s, startTime: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Hora fin</Label><Input type="time" value={newShift.endTime} onChange={e => setNewShift(s => ({ ...s, endTime: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Días de la semana</Label>
              <div className="flex gap-1">
                {DAY_NAMES.map((d, i) => (
                  <button key={i} type="button" onClick={() => setNewShift(s => ({ ...s, selectedDays: s.selectedDays.includes(i) ? s.selectedDays.filter(x => x !== i) : [...s.selectedDays, i].sort() }))}
                    className={cn('w-9 h-9 rounded-md text-xs font-medium border transition-colors', newShift.selectedDays.includes(i) ? 'bg-blue-500 text-white border-blue-600' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700')}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Máximo de guardias</Label><Input type="number" min={1} value={newShift.maxGuards} onChange={e => setNewShift(s => ({ ...s, maxGuards: parseInt(e.target.value) || 1 }))} className="bg-slate-900 border-slate-700" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateShift(false); setEditingShiftId(null); }}>Cancelar</Button>
            <Button onClick={handleSaveShift} disabled={!newShift.name.trim() || createShiftMut.isPending || updateShiftMut.isPending} className="gap-1">
              {(createShiftMut.isPending || updateShiftMut.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingShiftId ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Create Assignment Dialog ═══ */}
      <Dialog open={showCreateAssignment} onOpenChange={setShowCreateAssignment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Asignación</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Turno *</Label>
              <Select value={newAssignment.shiftId} onValueChange={v => setNewAssignment(a => ({ ...a, shiftId: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Seleccionar turno..." /></SelectTrigger>
                <SelectContent>{shiftsList.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Guardia *</Label>
              <Select value={newAssignment.userId} onValueChange={v => setNewAssignment(a => ({ ...a, userId: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Seleccionar guardia..." /></SelectTrigger>
                <SelectContent>{usersList.map((u: any) => <SelectItem key={u.id ?? u.userId} value={String(u.id ?? u.userId)}>{u.fullName || u.full_name || u.name || u.email || u.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Fecha *</Label><Input type="date" value={newAssignment.date} onChange={e => setNewAssignment(a => ({ ...a, date: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAssignment(false)}>Cancelar</Button>
            <Button onClick={() => createAssignmentMut.mutate(newAssignment)} disabled={!newAssignment.shiftId || !newAssignment.userId || createAssignmentMut.isPending} className="gap-1">
              {createAssignmentMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Calendar Detail Dialog ═══ */}
      <Dialog open={calendarDetail !== null} onOpenChange={o => { if (!o) setCalendarDetail(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {calendarDetail !== null && (
                <>{DAY_FULL[calendarDetail.dayIndex]} {weekDates[calendarDetail.dayIndex]?.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} — {SHIFT_BLOCKS[calendarDetail.blockIndex]?.label}</>
              )}
            </DialogTitle>
          </DialogHeader>
          {calendarDetail !== null && (() => {
            const cell = calendarData[calendarDetail.dayIndex]?.[calendarDetail.blockIndex];
            const guards = cell?.guards ?? [];
            return (
              <div className="space-y-3 py-2">
                {cell?.hasConflict && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 text-red-400 text-sm">
                    <AlertTriangle className="h-4 w-4" /> Conflicto: un guardia tiene múltiples turnos este día
                  </div>
                )}
                {guards.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay guardias asignados en este bloque.</p>
                ) : (
                  <div className="space-y-2">
                    {guards.map((g, gi) => (
                      <div key={gi} className="flex items-center gap-2 p-2 rounded-md bg-slate-800/50">
                        <div className={cn("w-3 h-3 rounded-full", guardColorMap.get(g.name) || "bg-slate-500")} />
                        <span className="text-sm font-medium text-white">{g.name}</span>
                        <Badge className={cn("ml-auto text-[9px] border", STATUS_COLORS[g.status] || '')}>{STATUS_LABELS[g.status] || g.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Button size="sm" className="w-full gap-1" onClick={() => {
                  const dateStr = weekDates[calendarDetail.dayIndex]?.toISOString().slice(0, 10) || '';
                  setNewAssignment({ ...defaultAssignment, date: dateStr });
                  setCalendarDetail(null);
                  setShowCreateAssignment(true);
                }}>
                  <Plus className="h-3 w-3" /> Crear Asignación
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="bg-slate-800/40 border-slate-700/50">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className={cn("text-2xl font-bold", color)}>{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <Card className="bg-slate-800/30 border-slate-700/40">
      <CardContent className="py-12 text-center">
        <div className="mx-auto mb-4 opacity-20 [&>svg]:h-12 [&>svg]:w-12 [&>svg]:mx-auto">{icon}</div>
        <p className="text-base font-medium text-white">{title}</p>
        <p className="text-sm text-slate-500 mt-1">{desc}</p>
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}
