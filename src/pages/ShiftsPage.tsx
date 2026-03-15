import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, shiftAssignmentsApi } from "@/services/shifts-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, CalendarCheck, UserCheck, Plus } from "lucide-react";

const assignmentStatusColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  checked_in: "bg-green-500",
  checked_out: "bg-gray-500",
  missed: "bg-red-500",
  excused: "bg-yellow-500",
};

export default function ShiftsPage() {
  const [activeTab, setActiveTab] = useState("shifts");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Shifts ──────────────────────────────────────────────
  const { data: shiftsData, isLoading: loadingShifts } = useQuery({
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Shift Management
          </h1>
          <p className="text-muted-foreground">
            Manage guard shifts and track attendance
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scheduled</p>
                <p className="text-3xl font-bold">{stats?.totalScheduled ?? 0}</p>
              </div>
              <CalendarCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Checked In</p>
                <p className="text-3xl font-bold text-green-500">{stats?.checkedIn ?? 0}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missed</p>
                <p className="text-3xl font-bold text-red-500">{stats?.missed ?? 0}</p>
              </div>
              <Clock className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Excused</p>
                <p className="text-3xl font-bold text-yellow-500">{stats?.excused ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-yellow-500" />
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
        </TabsList>

        {/* ── Shifts Tab ──────────────────────────────────── */}
        <TabsContent value="shifts" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> New Shift
            </Button>
          </div>
          {loadingShifts ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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
                      <Clock className={`h-5 w-5 ${shift.isActive ? 'text-blue-500' : 'text-muted-foreground'}`} />
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

        {/* ── Assignments Tab ─────────────────────────────── */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> New Assignment
            </Button>
          </div>
          {loadingAssignments ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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
                      <UserCheck className={`h-5 w-5 mt-0.5 ${assignment.status === 'checked_in' ? 'text-green-500' : 'text-muted-foreground'}`} />
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
  );
}
