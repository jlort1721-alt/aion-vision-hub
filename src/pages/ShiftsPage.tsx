import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, shiftAssignmentsApi } from "@/services/shifts-api";
import { apiClient } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Users, CalendarCheck, UserCheck, Plus, Loader2, CalendarDays, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/PageShell";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/contexts/I18nContext";

const assignmentStatusColors: Record<string, string> = {
  scheduled: "bg-primary",
  checked_in: "bg-success",
  checked_out: "bg-gray-500",
  missed: "bg-destructive",
  excused: "bg-warning",
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CALENDAR_DAY_KEYS = [
  { key: 'shifts.mon', fallback: 'Lun' },
  { key: 'shifts.tue', fallback: 'Mar' },
  { key: 'shifts.wed', fallback: 'Mié' },
  { key: 'shifts.thu', fallback: 'Jue' },
  { key: 'shifts.fri', fallback: 'Vie' },
  { key: 'shifts.sat', fallback: 'Sáb' },
  { key: 'shifts.sun', fallback: 'Dom' },
];
const SHIFT_BLOCK_KEYS = [
  { labelKey: 'shifts.block_morning', fallback: 'Mañana (06:00-14:00)', start: 6, end: 14 },
  { labelKey: 'shifts.block_afternoon', fallback: 'Tarde (14:00-22:00)', start: 14, end: 22 },
  { labelKey: 'shifts.block_night', fallback: 'Noche (22:00-06:00)', start: 22, end: 6 },
];
const GUARD_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-400',
];

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function parseTime(t: string): number {
  const [h] = (t || '0').split(':').map(Number);
  return h;
}

function shiftMatchesBlock(startTime: string, endTime: string, block: typeof SHIFT_BLOCK_KEYS[number]): boolean {
  const sh = parseTime(startTime);
  const eh = parseTime(endTime);
  if (block.start === 22) {
    return sh >= 22 || eh <= 6 || (sh >= 22 && eh <= 6);
  }
  return sh >= block.start && sh < block.end;
}

const defaultShift = { name: '', startTime: '06:00', endTime: '14:00', daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], maxGuards: 1 };
const defaultAssignment = { shiftId: '', userId: '', date: new Date().toISOString().slice(0, 10) };

export default function ShiftsPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("shifts");
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newShift, setNewShift] = useState(defaultShift);
  const [newAssignment, setNewAssignment] = useState(defaultAssignment);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarCellDetail, setCalendarCellDetail] = useState<{ dayIndex: number; blockIndex: number } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch users for the assignment picker
  const { data: usersData } = useQuery({
    queryKey: ['users-for-shifts'],
    queryFn: () => apiClient.get<Record<string, unknown>[] | { items: Record<string, unknown>[] }>('/users'),
  });
  const usersList = useMemo(() => {
    if (!usersData) return [];
    if (Array.isArray(usersData)) return usersData;
    if (usersData && typeof usersData === 'object' && 'items' in usersData) return (usersData as { items: Record<string, unknown>[] }).items;
    return [];
  }, [usersData]);

  const createShiftMutation = useMutation({
    mutationFn: (data: typeof defaultShift) => shiftsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast({ title: 'Shift created' }); setShowCreateShift(false); setNewShift(defaultShift); },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (data: typeof defaultAssignment) => shiftAssignmentsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast({ title: 'Assignment created' }); setShowCreateAssignment(false); setNewAssignment(defaultAssignment); },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ── Shifts ──────────────────────────────────────────────
  const { data: shiftsData, isLoading: loadingShifts, isError: shiftsError, error: shiftsErrorObj, refetch: refetchShifts } = useQuery({
    queryKey: ["shifts", "list"],
    queryFn: () => shiftsApi.list(),
  });

  const toggleShiftMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      shiftsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast({ title: "Shift updated" });
    },
  });

  // ── Assignments ─────────────────────────────────────────
  const { data: assignmentsData, isLoading: loadingAssignments } = useQuery({
    queryKey: ["shifts", "assignments"],
    queryFn: () => shiftAssignmentsApi.list(),
  });

  const { data: statsData } = useQuery({
    queryKey: ["shifts", "stats"],
    queryFn: () => shiftAssignmentsApi.stats(),
    refetchInterval: 30000,
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) =>
      shiftAssignmentsApi.update(id, { status: "checked_in", checkInTime: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast({ title: "Checked in successfully" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) =>
      shiftAssignmentsApi.update(id, { status: "checked_out", checkOutTime: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast({ title: "Checked out successfully" });
    },
  });

  const shifts = shiftsData?.data ?? [];
  const assignments = assignmentsData?.data ?? [];
  const stats = statsData?.data;

  // ── Calendar View logic ───────────────────────────────────
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const guardColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const a of assignments) {
      const key = a.userName || a.userId;
      if (key && !map.has(key)) {
        map.set(key, GUARD_COLORS[idx % GUARD_COLORS.length]);
        idx++;
      }
    }
    return map;
  }, [assignments]);

  const calendarData = useMemo(() => {
    // Build a 7 x 3 grid: calendarData[dayIndex][blockIndex] = list of guards
    const grid: { guards: { name: string; assignmentId: string; status: string }[]; hasConflict: boolean }[][] = Array.from(
      { length: 7 },
      () => Array.from({ length: 3 }, () => ({ guards: [], hasConflict: false }))
    );

    // Track per-day guard assignments for conflict detection
    const dayGuardBlocks: Map<string, Set<number>>[] = Array.from({ length: 7 }, () => new Map());

    for (const assignment of assignments) {
      if (!assignment.date) continue;
      const aDate = new Date(assignment.date);
      aDate.setHours(0, 0, 0, 0);
      const dayIdx = weekDates.findIndex(d => d.getTime() === aDate.getTime());
      if (dayIdx === -1) continue;

      // Find the shift to know start/end times
      const shift = shifts.find((s: any) => s.id === assignment.shiftId);
      const startTime = shift?.startTime || assignment.startTime || '06:00';
      const endTime = shift?.endTime || assignment.endTime || '14:00';
      const guardName = assignment.userName || assignment.userId || 'Unknown';

      for (let bi = 0; bi < SHIFT_BLOCK_KEYS.length; bi++) {
        if (shiftMatchesBlock(startTime, endTime, SHIFT_BLOCK_KEYS[bi])) {
          grid[dayIdx][bi].guards.push({
            name: guardName,
            assignmentId: assignment.id,
            status: assignment.status,
          });

          // Track for conflict detection
          const guardKey = guardName;
          if (!dayGuardBlocks[dayIdx].has(guardKey)) {
            dayGuardBlocks[dayIdx].set(guardKey, new Set());
          }
          dayGuardBlocks[dayIdx].get(guardKey)!.add(bi);
        }
      }
    }

    // Detect conflicts: a guard assigned to multiple blocks on the same day
    for (let di = 0; di < 7; di++) {
      for (const [, blocks] of dayGuardBlocks[di]) {
        if (blocks.size > 1) {
          for (const bi of blocks) {
            grid[di][bi].hasConflict = true;
          }
        }
      }
    }

    return grid;
  }, [assignments, shifts, weekDates]);

  const weekLabel = weekDates.length >= 7
    ? `${weekDates[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${weekDates[6].toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  if (shiftsError) return <ErrorState error={shiftsErrorObj as Error} onRetry={refetchShifts} />;

  return (
    <PageShell
      title="Shift Management"
      description="Manage guard shifts and track attendance"
      icon={<Clock className="h-5 w-5" />}
    >
      <div className="space-y-6 p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scheduled</p>
                <p className="text-3xl font-bold">{stats?.totalScheduled ?? 0}</p>
              </div>
              <CalendarCheck className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Checked In</p>
                <p className="text-3xl font-bold text-success">{stats?.checkedIn ?? 0}</p>
              </div>
              <UserCheck className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missed</p>
                <p className="text-3xl font-bold text-destructive">{stats?.missed ?? 0}</p>
              </div>
              <Clock className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Excused</p>
                <p className="text-3xl font-bold text-warning">{stats?.excused ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="shifts" className="gap-1">
            <Clock className="h-4 w-4" /> Shifts
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1">
            <Users className="h-4 w-4" /> Assignments
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1">
            <CalendarDays className="h-4 w-4" /> Calendar View
          </TabsTrigger>
        </TabsList>

        {/* ── Shifts Tab ──────────────────────────────────── */}
        <TabsContent value="shifts" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => setShowCreateShift(true)}>
              <Plus className="h-4 w-4" /> New Shift
            </Button>
          </div>

          <Dialog open={showCreateShift} onOpenChange={setShowCreateShift}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create Shift</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={newShift.name} onChange={e => setNewShift(s => ({ ...s, name: e.target.value }))} placeholder="Morning shift" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Start Time</Label><Input type="time" value={newShift.startTime} onChange={e => setNewShift(s => ({ ...s, startTime: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">End Time</Label><Input type="time" value={newShift.endTime} onChange={e => setNewShift(s => ({ ...s, endTime: e.target.value }))} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Days of Week</Label>
                  <div className="flex flex-wrap gap-2">{DAYS.map(d => (
                    <label key={d} className="flex items-center gap-1 text-xs"><Checkbox checked={(newShift.daysOfWeek || []).includes(d)} onCheckedChange={c => setNewShift(s => ({ ...s, daysOfWeek: c ? [...(s.daysOfWeek || []), d] : (s.daysOfWeek || []).filter(x => x !== d) }))} />{d}</label>
                  ))}</div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Max Guards</Label><Input type="number" min={1} value={newShift.maxGuards} onChange={e => setNewShift(s => ({ ...s, maxGuards: parseInt(e.target.value) || 1 }))} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowCreateShift(false)}>Cancel</Button>
                <Button onClick={() => createShiftMutation.mutate(newShift)} disabled={!newShift.name || createShiftMutation.isPending}>
                  {createShiftMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {loadingShifts ? (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-2">
                {[1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-8 rounded-lg" />)}
              </div>
              <Skeleton className="h-64 rounded-lg" />
            </div>
          ) : shifts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No shifts configured</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first shift to get started</p>
              </CardContent>
            </Card>
          ) : (
            shifts.map((shift: any) => (
              <Card key={shift.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className={`h-5 w-5 ${shift.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{shift.name}</h3>
                          <Badge variant="outline">{shift.startTime} - {shift.endTime}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Days: {shift.days?.join(', ') || 'Not set'} | Max Guards: {shift.maxGuards ?? 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={shift.isActive}
                      onCheckedChange={(checked) => toggleShiftMutation.mutate({ id: shift.id, isActive: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Calendar View Tab ──────────────────────────── */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[200px] text-center">{weekLabel}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>{t('shifts.today', 'Hoy')}</Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div
                className="grid min-w-[700px]"
                style={{
                  gridTemplateColumns: '140px repeat(7, 1fr)',
                  gridTemplateRows: 'auto repeat(3, 1fr)',
                }}
              >
                {/* Header row */}
                <div className="p-2 border-b border-r bg-muted/50 font-medium text-xs text-muted-foreground" />
                {CALENDAR_DAY_KEYS.map((day, di) => (
                  <div key={day.key} className="p-2 border-b bg-muted/50 text-center">
                    <div className="font-medium text-xs">{t(day.key, day.fallback)}</div>
                    <div className="text-xs text-muted-foreground">
                      {weekDates[di]?.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}

                {/* Shift block rows */}
                {SHIFT_BLOCK_KEYS.map((block, bi) => (
                  <>
                    <div key={`label-${bi}`} className="p-2 border-b border-r bg-muted/30 flex items-center">
                      <span className="text-xs font-medium">{t(block.labelKey, block.fallback)}</span>
                    </div>
                    {CALENDAR_DAY_KEYS.map((_, di) => {
                      const cell = calendarData[di]?.[bi];
                      const guards = cell?.guards ?? [];
                      const hasConflict = cell?.hasConflict ?? false;
                      return (
                        <div
                          key={`cell-${di}-${bi}`}
                          className="p-1.5 border-b min-h-[70px] cursor-pointer hover:bg-muted/20 transition-colors relative"
                          onClick={() => setCalendarCellDetail({ dayIndex: di, blockIndex: bi })}
                        >
                          {hasConflict && (
                            <div className="absolute top-1 right-1" title={t('shifts.conflict_tooltip', 'Conflicto: guardia en múltiples turnos')}>
                              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {guards.map((g, gi) => (
                              <Badge
                                key={gi}
                                className={`text-[10px] px-1.5 py-0 text-white ${guardColorMap.get(g.name) || 'bg-gray-500'}`}
                              >
                                {g.name.length > 12 ? g.name.slice(0, 12) + '...' : g.name}
                              </Badge>
                            ))}
                            {guards.length === 0 && (
                              <span className="text-[10px] text-muted-foreground italic">{t('shifts.unassigned', 'Sin asignar')}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cell Detail Dialog */}
          <Dialog open={calendarCellDetail !== null} onOpenChange={(o) => { if (!o) setCalendarCellDetail(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {calendarCellDetail !== null && (() => {
                    const dayEntry = CALENDAR_DAY_KEYS[calendarCellDetail.dayIndex];
                    const blockEntry = SHIFT_BLOCK_KEYS[calendarCellDetail.blockIndex];
                    return (
                      <>
                        {t(dayEntry.key, dayEntry.fallback)}{' '}
                        {weekDates[calendarCellDetail.dayIndex]?.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
                        {' - '}
                        {t(blockEntry.labelKey, blockEntry.fallback)}
                      </>
                    );
                  })()}
                </DialogTitle>
              </DialogHeader>
              {calendarCellDetail !== null && (() => {
                const cell = calendarData[calendarCellDetail.dayIndex]?.[calendarCellDetail.blockIndex];
                const guards = cell?.guards ?? [];
                return (
                  <div className="space-y-3 py-2">
                    {cell?.hasConflict && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        {t('shifts.conflict_detected', 'Conflicto detectado: un guardia tiene múltiples turnos este día')}
                      </div>
                    )}
                    {guards.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('shifts.no_guards_block', 'No hay guardias asignados en este bloque.')}</p>
                    ) : (
                      <div className="space-y-2">
                        {guards.map((g, gi) => (
                          <div key={gi} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                            <div className={`w-3 h-3 rounded-full ${guardColorMap.get(g.name) || 'bg-gray-500'}`} />
                            <span className="text-sm font-medium">{g.name}</span>
                            <Badge className={`ml-auto text-[10px] ${assignmentStatusColors[g.status] || 'bg-gray-500'}`}>
                              {g.status?.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => {
                        const dateStr = weekDates[calendarCellDetail.dayIndex]?.toISOString().slice(0, 10) || '';
                        setNewAssignment({ ...defaultAssignment, date: dateStr });
                        setCalendarCellDetail(null);
                        setShowCreateAssignment(true);
                      }}
                    >
                      <Plus className="h-3 w-3" /> {t('shifts.create_assignment', 'Crear Asignación')}
                    </Button>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Assignments Tab ─────────────────────────────── */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => setShowCreateAssignment(true)}>
              <Plus className="h-4 w-4" /> New Assignment
            </Button>
          </div>

          <Dialog open={showCreateAssignment} onOpenChange={setShowCreateAssignment}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1"><Label className="text-xs">Shift *</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newAssignment.shiftId} onChange={e => setNewAssignment(a => ({ ...a, shiftId: e.target.value }))}>
                    <option value="">Select shift...</option>
                    {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><Label className="text-xs">User *</Label>
                  <Select value={newAssignment.userId} onValueChange={(v) => setNewAssignment(a => ({ ...a, userId: v }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select user..." /></SelectTrigger>
                    <SelectContent>
                      {usersList.map((u) => (
                        <SelectItem key={String(u.id ?? u.userId)} value={String(u.id ?? u.userId)}>
                          {String(u.fullName || u.full_name || u.name || u.email || u.id || 'Unknown')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Date *</Label><Input type="date" value={newAssignment.date} onChange={e => setNewAssignment(a => ({ ...a, date: e.target.value }))} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowCreateAssignment(false)}>Cancel</Button>
                <Button onClick={() => createAssignmentMutation.mutate(newAssignment)} disabled={!newAssignment.shiftId || !newAssignment.userId || createAssignmentMutation.isPending}>
                  {createAssignmentMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {loadingAssignments ? (
            <div className="space-y-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : assignments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No assignments found</p>
                <p className="text-sm text-muted-foreground mt-1">Assign guards to shifts to track attendance</p>
              </CardContent>
            </Card>
          ) : (
            assignments.map((assignment: any) => (
              <Card key={assignment.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <UserCheck className={`h-5 w-5 mt-0.5 ${assignment.status === 'checked_in' ? 'text-success' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{assignment.userName || assignment.userId}</h3>
                          <Badge className={assignmentStatusColors[assignment.status] || 'bg-gray-500'}>
                            {assignment.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Date: {assignment.date ? new Date(assignment.date).toLocaleDateString() : 'N/A'}
                          {assignment.shiftName && ` | Shift: ${assignment.shiftName}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {assignment.checkInTime && `Check-in: ${new Date(assignment.checkInTime).toLocaleTimeString()}`}
                          {assignment.checkOutTime && ` | Check-out: ${new Date(assignment.checkOutTime).toLocaleTimeString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {assignment.status === 'scheduled' && (
                        <Button size="sm" variant="default" onClick={() => checkInMutation.mutate(assignment.id)}>
                          Check In
                        </Button>
                      )}
                      {assignment.status === 'checked_in' && (
                        <Button size="sm" variant="outline" onClick={() => checkOutMutation.mutate(assignment.id)}>
                          Check Out
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
    </PageShell>
  );
}
