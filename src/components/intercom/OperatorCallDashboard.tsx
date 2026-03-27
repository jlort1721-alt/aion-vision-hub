// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Operator Call Dashboard
// Real-time call management, statistics, and operator tools
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Phone, PhoneCall, PhoneOff, PhoneForwarded, Pause, Play, DoorOpen,
  Activity, Clock, Bot, Users, Shield, ChevronLeft, ChevronRight,
  AlertTriangle, Loader2, Wifi, CircleDot, Headphones, UserCheck,
  Zap, TestTube, Volume2, BarChart3, Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuth } from '@/contexts/AuthContext';
import { useIntercomDevices } from '@/hooks/use-module-data';
import { intercomApi } from '@/services/intercom-api';
import type { CallSession, CallStats, CallSessionFilters } from '@/services/intercom-api';

// ── Duration Counter Hook ──────────────────────────────────

function useLiveDuration(startedAt?: string): string {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!startedAt) {
      setElapsed('00:00');
      return;
    }

    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) {
        setElapsed(`${hrs}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      } else {
        setElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return elapsed;
}

// ── Call Duration Cell ─────────────────────────────────────

function LiveDurationCell({ startedAt }: { startedAt?: string }) {
  const duration = useLiveDuration(startedAt);
  return <span className="font-mono text-xs tabular-nums">{duration}</span>;
}

// ── Status Helpers ─────────────────────────────────────────

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ringing': return 'destructive';
    case 'active': return 'default';
    case 'on-hold': return 'secondary';
    case 'ended': return 'outline';
    case 'missed': return 'destructive';
    default: return 'outline';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'ringing': return 'text-amber-500';
    case 'active': return 'text-success';
    case 'on-hold': return 'text-primary';
    case 'ended': return 'text-muted-foreground';
    case 'missed': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ── Operator Status ────────────────────────────────────────

type OperatorStatusValue = 'available' | 'busy' | 'away';

const OPERATOR_STATUSES: { value: OperatorStatusValue; label: string; color: string }[] = [
  { value: 'available', label: 'Available', color: 'bg-success' },
  { value: 'busy', label: 'Busy', color: 'bg-destructive' },
  { value: 'away', label: 'Away', color: 'bg-warning' },
];

// ── Main Component ─────────────────────────────────────────

export default function OperatorCallDashboard() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { status: wsStatus, subscribe } = useWebSocket();
  const { data: devices = [] } = useIntercomDevices();

  // Local state
  const [operatorStatus, setOperatorStatus] = useState<OperatorStatusValue>('available');
  const [filterMode, setFilterMode] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDevice, setFilterDevice] = useState('all');
  const [recentPage, setRecentPage] = useState(1);
  const [selectedDeviceForDoor, setSelectedDeviceForDoor] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferSessionId, setTransferSessionId] = useState<string | null>(null);
  const pageSize = 25;

  // ── WebSocket subscription for real-time call events ─────

  useEffect(() => {
    const unsub = subscribe('intercom', (msg) => {
      const payload = msg.payload as { type?: string };
      if (
        payload.type === 'call.new' ||
        payload.type === 'call.updated' ||
        payload.type === 'call.ended'
      ) {
        queryClient.invalidateQueries({ queryKey: ['intercom_active_calls'] });
        queryClient.invalidateQueries({ queryKey: ['intercom_call_stats'] });
        queryClient.invalidateQueries({ queryKey: ['intercom_recent_calls'] });
      }

      if (payload.type === 'call.new') {
        toast.info('Incoming call', { description: 'New intercom call is ringing' });
      }
    });

    return unsub;
  }, [subscribe, queryClient]);

  // ── Queries ──────────────────────────────────────────────

  const {
    data: activeCallsResponse,
    isLoading: activeLoading,
  } = useQuery({
    queryKey: ['intercom_active_calls'],
    queryFn: () => intercomApi.listActiveCalls(),
    refetchInterval: 5000,
  });

  const activeCalls: CallSession[] = useMemo(() => {
    const resp = activeCallsResponse;
    if (!resp) return [];
    const d = resp.data;
    return (Array.isArray(d) ? d : []).filter(
      (c) => c.status === 'ringing' || c.status === 'active' || c.status === 'on-hold'
    );
  }, [activeCallsResponse]);

  const {
    data: statsResponse,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ['intercom_call_stats'],
    queryFn: () => intercomApi.getCallStats(),
    refetchInterval: 15000,
  });

  const stats: CallStats = useMemo(() => {
    const defaults: CallStats = {
      active_calls: 0,
      calls_today: 0,
      avg_duration_seconds: 0,
      ai_handled: 0,
      human_handled: 0,
      access_granted: 0,
    };
    if (!statsResponse) return defaults;
    const d = statsResponse.data;
    return typeof d === 'object' && d !== null ? { ...defaults, ...d } : defaults;
  }, [statsResponse]);

  const recentFilters: CallSessionFilters = useMemo(() => {
    const f: CallSessionFilters = {
      page: recentPage,
      page_size: pageSize,
    };
    if (filterMode !== 'all') f.mode = filterMode;
    if (filterStatus !== 'all') f.status = filterStatus;
    if (filterDevice !== 'all') f.device_id = filterDevice;
    return f;
  }, [recentPage, filterMode, filterStatus, filterDevice]);

  const {
    data: recentCallsResponse,
    isLoading: recentLoading,
  } = useQuery({
    queryKey: ['intercom_recent_calls', recentFilters],
    queryFn: () => intercomApi.listRecentCalls(recentFilters),
    refetchInterval: 30000,
  });

  const recentCalls: CallSession[] = useMemo(() => {
    const resp = recentCallsResponse;
    if (!resp) return [];
    const d = resp.data;
    return Array.isArray(d) ? d : [];
  }, [recentCallsResponse]);

  // ── Mutations ────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['intercom_active_calls'] });
    queryClient.invalidateQueries({ queryKey: ['intercom_call_stats'] });
    queryClient.invalidateQueries({ queryKey: ['intercom_recent_calls'] });
  };

  const answerMutation = useMutation({
    mutationFn: (sessionId: string) => intercomApi.answerCall(sessionId),
    onSuccess: () => { toast.success('Call answered'); invalidateAll(); },
    onError: (e: Error) => toast.error(`Failed to answer: ${e.message}`),
  });

  const holdMutation = useMutation({
    mutationFn: (sessionId: string) => intercomApi.holdCall(sessionId),
    onSuccess: () => { toast.success('Call on hold'); invalidateAll(); },
    onError: (e: Error) => toast.error(`Failed to hold: ${e.message}`),
  });

  const resumeMutation = useMutation({
    mutationFn: (sessionId: string) => intercomApi.resumeCall(sessionId),
    onSuccess: () => { toast.success('Call resumed'); invalidateAll(); },
    onError: (e: Error) => toast.error(`Failed to resume: ${e.message}`),
  });

  const transferMutation = useMutation({
    mutationFn: ({ sessionId, target }: { sessionId: string; target: string }) =>
      intercomApi.transferCall(sessionId, target),
    onSuccess: () => {
      toast.success('Call transferred');
      setTransferSessionId(null);
      setTransferTarget('');
      invalidateAll();
    },
    onError: (e: Error) => toast.error(`Transfer failed: ${e.message}`),
  });

  const hangupMutation = useMutation({
    mutationFn: (sessionId: string) => intercomApi.hangupCall(sessionId),
    onSuccess: () => { toast.success('Call ended'); invalidateAll(); },
    onError: (e: Error) => toast.error(`Failed to hang up: ${e.message}`),
  });

  const doorMutation = useMutation({
    mutationFn: ({ deviceId, reason }: { deviceId: string; reason?: string }) =>
      intercomApi.openDoor(deviceId, reason),
    onSuccess: () => toast.success('Door opened successfully'),
    onError: (e: Error) => toast.error(`Door open failed: ${e.message}`),
  });

  const testDeviceMutation = useMutation({
    mutationFn: ({ ip, brand }: { ip: string; brand: string }) =>
      intercomApi.testDevice(ip, brand),
    onSuccess: (result) => {
      const data = result?.data;
      if (data?.reachable) {
        toast.success(`Device reachable (${data.latency_ms}ms)`);
      } else {
        toast.warning('Device unreachable');
      }
    },
    onError: (e: Error) => toast.error(`Test failed: ${e.message}`),
  });

  // ── Handlers ─────────────────────────────────────────────

  const handleOpenDoor = useCallback((deviceId: string) => {
    if (!deviceId) {
      toast.warning('Select a device first');
      return;
    }
    doorMutation.mutate({ deviceId, reason: 'operator_manual' });
  }, [doorMutation]);

  const handleOpenDoorForCall = useCallback((call: CallSession) => {
    if (!call.device_id) {
      toast.warning('No device associated with this call');
      return;
    }
    doorMutation.mutate({ deviceId: call.device_id, reason: `call_session:${call.id}` });
  }, [doorMutation]);

  const handleTransfer = useCallback(() => {
    if (!transferSessionId || !transferTarget.trim()) return;
    transferMutation.mutate({ sessionId: transferSessionId, target: transferTarget });
  }, [transferSessionId, transferTarget, transferMutation]);

  const handleTestDevice = useCallback(() => {
    if (!selectedDeviceForDoor) {
      toast.warning('Select a device first');
      return;
    }
    const device = devices.find((d: any) => d.id === selectedDeviceForDoor);
    if (!device?.ip_address) {
      toast.warning('Device has no IP address configured');
      return;
    }
    testDeviceMutation.mutate({ ip: device.ip_address, brand: device.brand || 'generic' });
  }, [selectedDeviceForDoor, devices, testDeviceMutation]);

  const onlineDevices = useMemo(
    () => devices.filter((d: any) => d.status === 'online'),
    [devices]
  );

  // ── Computed values ──────────────────────────────────────

  const totalHandled = stats.ai_handled + stats.human_handled;
  const aiRatio = totalHandled > 0 ? Math.round((stats.ai_handled / totalHandled) * 100) : 0;

  // ── Render ───────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* ── Main Content ────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* ── Statistics Cards ────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-success/10">
                  <PhoneCall className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Active</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-8 mt-0.5" />
                  ) : (
                    <p className="text-xl font-bold">{activeCalls.length}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Today</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-8 mt-0.5" />
                  ) : (
                    <p className="text-xl font-bold">{stats.calls_today}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-500/10">
                  <Timer className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Avg Duration</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-12 mt-0.5" />
                  ) : (
                    <p className="text-xl font-bold">{formatDuration(stats.avg_duration_seconds)}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10">
                  <Bot className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">AI / Human</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-16 mt-0.5" />
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <p className="text-xl font-bold">{aiRatio}%</p>
                      <span className="text-[10px] text-muted-foreground">AI</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-success/10">
                  <DoorOpen className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Access</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-8 mt-0.5" />
                  ) : (
                    <p className="text-xl font-bold">{stats.access_granted}</p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* ── Active Calls Panel ────────────────────── */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-success" />
                  Active Calls
                  {activeCalls.length > 0 && (
                    <Badge variant="default" className="text-[10px] ml-1">
                      {activeCalls.length}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <div className={cn('h-1.5 w-1.5 rounded-full', wsStatus === 'connected' ? 'bg-success' : 'bg-destructive')} />
                  {wsStatus === 'connected' ? 'Live' : 'Polling'}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : activeCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Phone className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No active calls</p>
                  <p className="text-[10px] mt-0.5">Incoming calls will appear here in real-time</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeCalls.map((call) => (
                    <ActiveCallRow
                      key={call.id}
                      call={call}
                      onAnswer={() => answerMutation.mutate(call.id)}
                      onHold={() => holdMutation.mutate(call.id)}
                      onResume={() => resumeMutation.mutate(call.id)}
                      onHangup={() => hangupMutation.mutate(call.id)}
                      onOpenDoor={() => handleOpenDoorForCall(call)}
                      onTransfer={() => {
                        setTransferSessionId(call.id);
                        setTransferTarget('');
                      }}
                      isAnswering={answerMutation.isPending}
                      isHanging={hangupMutation.isPending}
                      isDoorOpening={doorMutation.isPending}
                    />
                  ))}
                </div>
              )}

              {/* Transfer dialog inline */}
              {transferSessionId && (
                <div className="mt-3 p-3 rounded-lg border bg-muted/30 space-y-2">
                  <p className="text-xs font-medium">Transfer call to:</p>
                  <div className="flex gap-2">
                    <Select value={transferTarget} onValueChange={setTransferTarget}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Select operator..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator_1">Operator 1</SelectItem>
                        <SelectItem value="operator_2">Operator 2</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={handleTransfer}
                      disabled={!transferTarget || transferMutation.isPending}
                    >
                      {transferMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <PhoneForwarded className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setTransferSessionId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Recent Calls Log ────────────────────── */}
          <Card className="border-border/50 flex-1">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Recent Calls
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterMode} onValueChange={(v) => { setFilterMode(v); setRecentPage(1); }}>
                    <SelectTrigger className="h-7 text-[11px] w-[110px]">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All modes</SelectItem>
                      <SelectItem value="ai">AI</SelectItem>
                      <SelectItem value="human">Human</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setRecentPage(1); }}>
                    <SelectTrigger className="h-7 text-[11px] w-[110px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                      <SelectItem value="missed">Missed</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterDevice} onValueChange={(v) => { setFilterDevice(v); setRecentPage(1); }}>
                    <SelectTrigger className="h-7 text-[11px] w-[130px]">
                      <SelectValue placeholder="Device" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All devices</SelectItem>
                      {devices.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : recentCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Clock className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No call records found</p>
                  <p className="text-[10px] mt-0.5">Adjust filters or wait for incoming calls</p>
                </div>
              ) : (
                <>
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Time</TableHead>
                          <TableHead className="text-[10px]">Caller</TableHead>
                          <TableHead className="text-[10px]">Device</TableHead>
                          <TableHead className="text-[10px]">Duration</TableHead>
                          <TableHead className="text-[10px]">Mode</TableHead>
                          <TableHead className="text-[10px]">Access</TableHead>
                          <TableHead className="text-[10px]">Recording</TableHead>
                          <TableHead className="text-[10px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentCalls.map((call) => (
                          <TableRow key={call.id}>
                            <TableCell className="text-xs font-mono whitespace-nowrap">
                              {new Date(call.started_at).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="truncate max-w-[140px]">
                                {call.caller_name || call.caller_id || 'Unknown'}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {call.device_name || call.device_id?.slice(0, 8) || '--'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {formatDuration(call.duration_seconds)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px]',
                                  call.mode === 'ai'
                                    ? 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                                    : 'border-primary/30 text-primary bg-primary/10'
                                )}
                              >
                                {call.mode === 'ai' ? (
                                  <><Bot className="inline h-2.5 w-2.5 mr-0.5" /> AI</>
                                ) : (
                                  <><Headphones className="inline h-2.5 w-2.5 mr-0.5" /> Human</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {call.access_granted != null && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px]',
                                    call.access_granted
                                      ? 'border-success/30 text-success bg-success/10'
                                      : 'border-destructive/30 text-destructive bg-destructive/10'
                                  )}
                                >
                                  {call.access_granted ? 'Granted' : 'Denied'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {call.recording_url ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        const audio = new Audio(call.recording_url!);
                                        audio.play().catch(() =>
                                          toast.error('Unable to play recording')
                                        );
                                      }}
                                    >
                                      <Play className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Play recording</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">--</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(call.status)} className="text-[10px] capitalize">
                                {call.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-3">
                    <p className="text-[10px] text-muted-foreground">
                      Page {recentPage} {recentCalls.length === pageSize && '(more available)'}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                        disabled={recentPage <= 1}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRecentPage((p) => p + 1)}
                        disabled={recentCalls.length < pageSize}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ────────────────────── */}
        <div className="w-full lg:w-[260px] flex flex-col gap-4 shrink-0">

          {/* Operator Status */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Operator Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  operatorStatus === 'available' ? 'bg-success' :
                  operatorStatus === 'busy' ? 'bg-destructive' : 'bg-warning'
                )} />
                <Select value={operatorStatus} onValueChange={(v) => setOperatorStatus(v as OperatorStatusValue)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn('h-2 w-2 rounded-full', s.color)} />
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Online Operators</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="truncate">{profile?.full_name || 'You'}</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">you</Badge>
                  </div>
                  {/* Placeholder for other operators - would come from a real API */}
                  <p className="text-[10px] text-muted-foreground italic">No other operators online</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Device selector */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Target Device</p>
                <Select value={selectedDeviceForDoor} onValueChange={setSelectedDeviceForDoor}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select device..." />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.length === 0 ? (
                      <SelectItem value="none" disabled>No devices</SelectItem>
                    ) : (
                      devices.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex items-center gap-1.5">
                            <div className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              d.status === 'online' ? 'bg-success' : 'bg-gray-400'
                            )} />
                            {d.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Open Gate */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full h-10 bg-success hover:bg-success/90 text-white gap-2"
                    onClick={() => handleOpenDoor(selectedDeviceForDoor)}
                    disabled={!selectedDeviceForDoor || doorMutation.isPending}
                  >
                    {doorMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <DoorOpen className="h-4 w-4" />
                    )}
                    Open Gate
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Trigger door relay on selected device</TooltipContent>
              </Tooltip>

              {/* Test Device */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 gap-2 text-xs"
                    onClick={handleTestDevice}
                    disabled={!selectedDeviceForDoor || testDeviceMutation.isPending}
                  >
                    {testDeviceMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <TestTube className="h-3.5 w-3.5" />
                    )}
                    Test Device
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Test device network reachability</TooltipContent>
              </Tooltip>

              {/* Emergency Call */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full h-9 gap-2 text-xs"
                    onClick={() => toast.info('Emergency call initiated. Contacting security supervisor.')}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Emergency Call
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Initiate emergency protocol call</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Active Call Row Sub-component ──────────────────────────

interface ActiveCallRowProps {
  call: CallSession;
  onAnswer: () => void;
  onHold: () => void;
  onResume: () => void;
  onHangup: () => void;
  onOpenDoor: () => void;
  onTransfer: () => void;
  isAnswering: boolean;
  isHanging: boolean;
  isDoorOpening: boolean;
}

function ActiveCallRow({
  call,
  onAnswer,
  onHold,
  onResume,
  onHangup,
  onOpenDoor,
  onTransfer,
  isAnswering,
  isHanging,
  isDoorOpening,
}: ActiveCallRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        call.status === 'ringing' && 'border-amber-500/40 bg-amber-500/5 animate-pulse',
        call.status === 'active' && 'border-success/30 bg-success/5',
        call.status === 'on-hold' && 'border-primary/30 bg-primary/5'
      )}
    >
      {/* Status indicator */}
      <div className="shrink-0">
        <div className={cn('h-3 w-3 rounded-full', statusColor(call.status))} />
      </div>

      {/* Call info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {call.caller_name || call.caller_id || 'Unknown Caller'}
          </p>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] shrink-0',
              call.mode === 'ai'
                ? 'border-amber-500/30 text-amber-500'
                : 'border-primary/30 text-primary'
            )}
          >
            {call.mode === 'ai' ? 'AI' : 'Human'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          <span>{call.device_name || call.device_id?.slice(0, 8) || '--'}</span>
          {call.site_name && (
            <>
              <span className="opacity-30">|</span>
              <span>{call.site_name}</span>
            </>
          )}
          {call.attended_by && (
            <>
              <span className="opacity-30">|</span>
              <span className="capitalize">{call.attended_by}</span>
            </>
          )}
        </div>
      </div>

      {/* Duration */}
      <div className="shrink-0 text-right">
        <Badge variant={statusBadgeVariant(call.status)} className="text-[10px] capitalize mb-0.5">
          {call.status}
        </Badge>
        <div className="mt-0.5">
          <LiveDurationCell startedAt={call.answered_at || call.started_at} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        {call.status === 'ringing' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-8 w-8 bg-success hover:bg-success/90 text-white"
                onClick={onAnswer}
                disabled={isAnswering}
              >
                {isAnswering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Answer</TooltipContent>
          </Tooltip>
        )}

        {call.status === 'active' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={onHold}
              >
                <Pause className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hold</TooltipContent>
          </Tooltip>
        )}

        {call.status === 'on-hold' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={onResume}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Resume</TooltipContent>
          </Tooltip>
        )}

        {(call.status === 'active' || call.status === 'on-hold') && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={onTransfer}
                >
                  <PhoneForwarded className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Transfer</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 text-success hover:text-success/90 hover:border-success/50"
                  onClick={onOpenDoor}
                  disabled={isDoorOpening}
                >
                  {isDoorOpening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DoorOpen className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open Gate</TooltipContent>
            </Tooltip>
          </>
        )}

        {call.status !== 'ended' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
                onClick={onHangup}
                disabled={isHanging}
              >
                {isHanging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOff className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hang up</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
