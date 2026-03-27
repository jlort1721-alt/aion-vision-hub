import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { deviceControlApi } from '@/services/device-control-api';
import { whatsappApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDevices,
} from '@/hooks/use-supabase-data';
import {
  useDomoticDevices,
  useIntercomDevices,
  useAccessPeople,
  useAccessVehicles,
  useRebootMutations,
} from '@/hooks/use-module-data';
import { toast } from 'sonner';
import {
  DoorOpen, Lightbulb, Siren, RotateCcw, Plug,
  Search, User, Car, Database,
  Phone, Megaphone, MessageSquare, Bot,
  Loader2, ShieldAlert, CheckCircle2, XCircle,
  Send, RefreshCw,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface ApiResponse<T = any> {
  data: T[] | T;
  meta?: any;
}

// ── Main Page ────────────────────────────────────────────────

export default function OperationsPanelPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Operations Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Unified control center for security operations. Execute quick actions across all platform modules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Column 1: Device Control */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Device Control
          </h2>
          <GateControlCard />
          <LightsControlCard />
          <SirenControlCard />
          <DeviceRestartCard />
          <EwelinkStatusCard />
        </div>

        {/* Column 2: Search & Lookup */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Search & Lookup
          </h2>
          <ResidentLookupCard />
          <VehicleLookupCard />
          <DatabaseSearchCard />
        </div>

        {/* Column 3: Communications */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Communications
          </h2>
          <QuickCallCard />
          <WelcomeMessageCard />
          <WhatsAppQuickSendCard />
          <AskAionCard />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COLUMN 1: DEVICE CONTROL
// ═══════════════════════════════════════════════════════════════

function GateControlCard() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: devices = [] } = useDevices();

  const gateDevices = useMemo(() =>
    devices.filter(
      (d) =>
        d.status === 'online' &&
        (d.type === 'access_control' ||
          d.type === 'intercom' ||
          d.brand?.toLowerCase().includes('hikvision') ||
          d.brand?.toLowerCase().includes('dahua') ||
          d.name?.toLowerCase().includes('gate') ||
          d.name?.toLowerCase().includes('puerta') ||
          d.name?.toLowerCase().includes('door') ||
          d.name?.toLowerCase().includes('barrera') ||
          d.name?.toLowerCase().includes('acceso'))
    ), [devices]);

  const openGateMutation = useMutation({
    mutationFn: () => deviceControlApi.openGate(selectedDevice, reason || 'Manual gate open from Operations Panel'),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Gate opened successfully', {
          description: `Device: ${gateDevices.find((d) => d.id === selectedDevice)?.name || selectedDevice}`,
        });
      } else {
        toast.error('Failed to open gate', {
          description: result.data?.error || result.data?.message || 'Unknown error',
        });
      }
      setConfirmOpen(false);
      setReason('');
    },
    onError: (err: Error) => {
      toast.error('Error opening gate', { description: err.message });
      setConfirmOpen(false);
    },
  });

  const handleOpenGate = () => {
    if (!selectedDevice) {
      toast.warning('Select a gate device first');
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DoorOpen className="h-4 w-4" /> Gate Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Device</Label>
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger>
                <SelectValue placeholder="Select gate/door device..." />
              </SelectTrigger>
              <SelectContent>
                {gateDevices.length === 0 ? (
                  <SelectItem value="_none" disabled>No gate devices online</SelectItem>
                ) : (
                  gateDevices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        {d.name}
                        {d.ip_address && (
                          <span className="text-xs text-muted-foreground ml-1">({d.ip_address})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Reason (optional)</Label>
            <Input
              placeholder="e.g. Visitor arrival, delivery..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handleOpenGate} disabled={!selectedDevice}>
            <DoorOpen className="mr-2 h-4 w-4" /> Open Gate
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" /> Confirm Gate Opening
            </DialogTitle>
            <DialogDescription>
              This will send an open command to{' '}
              <strong>{gateDevices.find((d) => d.id === selectedDevice)?.name || 'the selected device'}</strong>.
              This action is logged and audited.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => openGateMutation.mutate()}
              disabled={openGateMutation.isPending}
            >
              {openGateMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Open</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LightsControlCard() {
  const { data: domoticDevices = [], isLoading } = useDomoticDevices();
  const queryClient = useQueryClient();

  const lightDevices = useMemo(() =>
    domoticDevices.filter(
      (d: any) =>
        d.type === 'light' ||
        d.type === 'relay' ||
        d.name?.toLowerCase().includes('luz') ||
        d.name?.toLowerCase().includes('light') ||
        d.name?.toLowerCase().includes('lamp') ||
        d.name?.toLowerCase().includes('iluminacion')
    ), [domoticDevices]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, currentState }: { id: string; currentState: string }) => {
      const newState = currentState === 'on' ? 'off' : 'on';
      await apiClient.post(`/domotics/${id}/action`, {
        action: 'toggle',
        state: newState,
      });
      return { id, newState };
    },
    onSuccess: ({ newState }) => {
      queryClient.invalidateQueries({ queryKey: ['domotic_devices'] });
      toast.success(`Light switched ${newState}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to toggle light', { description: err.message });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4" /> Lights Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : lightDevices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No light devices configured</p>
        ) : (
          lightDevices.map((device: any) => (
            <div key={device.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
              <div className="flex items-center gap-2 min-w-0">
                <Lightbulb className={`h-4 w-4 shrink-0 ${device.state === 'on' ? 'text-warning' : 'text-muted-foreground'}`} />
                <span className="text-sm truncate">{device.name}</span>
              </div>
              <Switch
                checked={device.state === 'on'}
                onCheckedChange={() => toggleMutation.mutate({ id: device.id, currentState: device.state || 'off' })}
                disabled={toggleMutation.isPending}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SirenControlCard() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [duration, setDuration] = useState('30');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: domoticDevices = [], isLoading } = useDomoticDevices();

  const sirenDevices = useMemo(() =>
    domoticDevices.filter(
      (d: any) =>
        d.type === 'siren' ||
        d.type === 'alarm' ||
        d.name?.toLowerCase().includes('sirena') ||
        d.name?.toLowerCase().includes('siren') ||
        d.name?.toLowerCase().includes('alarm')
    ), [domoticDevices]);

  const activateMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/domotics/${selectedDevice}/action`, {
        action: 'activate',
        duration: parseInt(duration, 10),
      });
    },
    onSuccess: () => {
      toast.success('Siren activated', {
        description: `Duration: ${duration}s - ${sirenDevices.find((d: any) => d.id === selectedDevice)?.name}`,
      });
      setConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error('Failed to activate siren', { description: err.message });
      setConfirmOpen(false);
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Siren className="h-4 w-4" /> Siren Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Zone / Device</Label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select siren zone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sirenDevices.length === 0 ? (
                      <SelectItem value="_none" disabled>No siren devices configured</SelectItem>
                    ) : (
                      sirenDevices.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">60 seconds</SelectItem>
                    <SelectItem value="120">120 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  if (!selectedDevice) {
                    toast.warning('Select a siren device first');
                    return;
                  }
                  setConfirmOpen(true);
                }}
                disabled={!selectedDevice}
              >
                <Siren className="mr-2 h-4 w-4" /> Activate Siren
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Confirm Siren Activation
            </DialogTitle>
            <DialogDescription>
              This will activate the siren on{' '}
              <strong>{sirenDevices.find((d: any) => d.id === selectedDevice)?.name || 'the selected device'}</strong>{' '}
              for <strong>{duration} seconds</strong>. This action is logged and audited.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating...</>
              ) : (
                <><Siren className="mr-2 h-4 w-4" /> Confirm Activate</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeviceRestartCard() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: devices = [], isLoading } = useDevices();
  const { create: createReboot } = useRebootMutations();

  const onlineDevices = useMemo(() =>
    devices.filter((d) => d.status === 'online'), [devices]);

  const rebootMutation = useMutation({
    mutationFn: async () => {
      await deviceControlApi.reboot(selectedDevice, 'Manual reboot from Operations Panel');
      createReboot.mutate({ device_id: selectedDevice, reason: 'Manual reboot from Operations Panel' });
    },
    onSuccess: () => {
      toast.success('Reboot command sent', {
        description: `Device: ${onlineDevices.find((d) => d.id === selectedDevice)?.name || selectedDevice}`,
      });
      setConfirmOpen(false);
      setSelectedDevice('');
    },
    onError: (err: Error) => {
      toast.error('Failed to reboot device', { description: err.message });
      setConfirmOpen(false);
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Device Restart
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Device</Label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device to restart..." />
                  </SelectTrigger>
                  <SelectContent>
                    {onlineDevices.length === 0 ? (
                      <SelectItem value="_none" disabled>No devices online</SelectItem>
                    ) : (
                      onlineDevices.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-success" />
                            {d.name}
                            {d.ip_address && (
                              <span className="text-xs text-muted-foreground ml-1">({d.ip_address})</span>
                            )}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!selectedDevice) {
                    toast.warning('Select a device first');
                    return;
                  }
                  setConfirmOpen(true);
                }}
                disabled={!selectedDevice}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Restart Device
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" /> Confirm Device Restart
            </DialogTitle>
            <DialogDescription>
              This will send a reboot command to{' '}
              <strong>{onlineDevices.find((d) => d.id === selectedDevice)?.name || 'the selected device'}</strong>.
              The device will be temporarily offline during restart. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rebootMutation.mutate()}
              disabled={rebootMutation.isPending}
            >
              {rebootMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restarting...</>
              ) : (
                <><RotateCcw className="mr-2 h-4 w-4" /> Confirm Restart</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EwelinkStatusCard() {
  const { isAuthenticated } = useAuth();

  const { data: ewelinkData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ewelink-status'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: any }>('/ewelink');
      return response;
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const status = (ewelinkData as any)?.data?.status || (ewelinkData as any)?.status || 'unknown';
  const isConnected = status === 'connected' || status === 'online' || status === 'ok';
  const deviceCount = (ewelinkData as any)?.data?.devices?.length || (ewelinkData as any)?.devices?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="h-4 w-4" /> eWeLink Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`} />
                <span className="text-sm font-medium">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <Badge variant={isConnected ? 'secondary' : 'destructive'}>
                {deviceCount} device{deviceCount !== 1 ? 's' : ''}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              {isRefetching ? (
                <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Syncing...</>
              ) : (
                <><RefreshCw className="mr-2 h-3 w-3" /> Sync Status</>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// COLUMN 2: SEARCH & LOOKUP
// ═══════════════════════════════════════════════════════════════

function ResidentLookupCard() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: people = [], isLoading } = useAccessPeople();

  const results = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return (people as any[]).filter(
      (p) =>
        p.full_name?.toLowerCase().includes(term) ||
        p.unit?.toLowerCase().includes(term) ||
        p.phone?.includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.document_id?.includes(term)
    ).slice(0, 8);
  }, [people, searchTerm]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" /> Resident Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, unit, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {isLoading && searchTerm.trim() ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {results.map((person: any) => (
              <div key={person.id} className="p-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{person.full_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{person.type || 'resident'}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {person.unit && <span>Unit: {person.unit}</span>}
                  {person.phone && <span>{person.phone}</span>}
                </div>
                {person.email && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{person.email}</p>
                )}
              </div>
            ))}
          </div>
        ) : searchTerm.trim() ? (
          <p className="text-sm text-muted-foreground text-center py-4">No residents found</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Type to search residents</p>
        )}
      </CardContent>
    </Card>
  );
}

function VehicleLookupCard() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: vehicles = [], isLoading } = useAccessVehicles();
  const { data: people = [] } = useAccessPeople();

  const results = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return (vehicles as any[]).filter(
      (v) =>
        v.plate?.toLowerCase().includes(term) ||
        v.brand?.toLowerCase().includes(term) ||
        v.model?.toLowerCase().includes(term) ||
        v.color?.toLowerCase().includes(term)
    ).slice(0, 8).map((v) => ({
      ...v,
      owner: (people as any[]).find((p) => p.id === v.person_id),
    }));
  }, [vehicles, people, searchTerm]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Car className="h-4 w-4" /> Vehicle Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by plate, brand, model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            className="pl-9"
          />
        </div>
        {isLoading && searchTerm.trim() ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {results.map((vehicle: any) => (
              <div key={vehicle.id} className="p-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold font-mono tracking-wider">{vehicle.plate}</span>
                  <Badge variant="secondary" className="text-[10px]">{vehicle.type || 'vehicle'}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {vehicle.brand && <span>{vehicle.brand}</span>}
                  {vehicle.model && <span>{vehicle.model}</span>}
                  {vehicle.color && <span>{vehicle.color}</span>}
                </div>
                {vehicle.owner && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{vehicle.owner.full_name}</span>
                    {vehicle.owner.unit && (
                      <span className="text-muted-foreground">- Unit {vehicle.owner.unit}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : searchTerm.trim() ? (
          <p className="text-sm text-muted-foreground text-center py-4">No vehicles found</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Type to search vehicles</p>
        )}
      </CardContent>
    </Card>
  );
}

function DatabaseSearchCard() {
  const [searchTerm, setSearchTerm] = useState('');
  const { isAuthenticated } = useAuth();

  const { data: searchResults, isLoading, isFetching } = useQuery({
    queryKey: ['ops-db-search', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse>('/database-records', { search: searchTerm });
      return (Array.isArray(response.data) ? response.data : []) as any[];
    },
    enabled: isAuthenticated && searchTerm.trim().length >= 2,
  });

  const results = searchResults || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" /> Database Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Full-text search (min 2 chars)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {(isLoading || isFetching) && searchTerm.trim().length >= 2 ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {results.slice(0, 10).map((record: any) => (
              <div key={record.id} className="p-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{record.title || record.name || 'Untitled'}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{record.category || 'record'}</Badge>
                </div>
                {record.tags && record.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {record.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : searchTerm.trim().length >= 2 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No records found</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Enter at least 2 characters to search</p>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// COLUMN 3: COMMUNICATIONS
// ═══════════════════════════════════════════════════════════════

function QuickCallCard() {
  const [number, setNumber] = useState('');

  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  const handleCall = () => {
    if (!number.trim()) {
      toast.warning('Enter a number or extension');
      return;
    }
    const protocol = isMobile ? 'tel:' : 'sip:';
    window.location.href = `${protocol}${number.trim()}`;
    toast.success('Initiating call', { description: `Dialing ${number.trim()}` });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4" /> Quick Call
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Number / Extension</Label>
          <Input
            type="tel"
            placeholder="Enter number or extension..."
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCall();
            }}
          />
        </div>
        <Button className="w-full" onClick={handleCall} disabled={!number.trim()}>
          <Phone className="mr-2 h-4 w-4" /> Call {isMobile ? '(Phone)' : '(SIP)'}
        </Button>
      </CardContent>
    </Card>
  );
}

function WelcomeMessageCard() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('welcome_default');

  const { data: intercomDevices = [], isLoading } = useIntercomDevices();

  const templates = [
    { id: 'welcome_default', label: 'Default Welcome' },
    { id: 'welcome_visitor', label: 'Visitor Welcome' },
    { id: 'welcome_delivery', label: 'Delivery Notice' },
    { id: 'announcement_general', label: 'General Announcement' },
    { id: 'announcement_emergency', label: 'Emergency Announcement' },
  ];

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/intercom/devices/test', {
        device_id: selectedDevice,
        template: selectedTemplate,
        type: 'audio',
      });
    },
    onSuccess: () => {
      toast.success('Welcome message sent', {
        description: `Template: ${templates.find((t) => t.id === selectedTemplate)?.label}`,
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to send message', { description: err.message });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4" /> Welcome Message
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-xs">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Device</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select intercom device..." />
                </SelectTrigger>
                <SelectContent>
                  {(intercomDevices as any[]).length === 0 ? (
                    <SelectItem value="_none" disabled>No intercom devices</SelectItem>
                  ) : (
                    (intercomDevices as any[]).map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => sendMutation.mutate()}
              disabled={!selectedDevice || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Send Message</>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WhatsAppQuickSendCard() {
  const [recipient, setRecipient] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const { isAuthenticated } = useAuth();

  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['whatsapp-templates-ops'],
    queryFn: () => whatsappApi.listTemplates(),
    enabled: isAuthenticated,
  });

  const templates = (templatesData as any)?.data || (templatesData as any)?.templates || [];

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        to: recipient.trim(),
        type: selectedTemplate ? 'template' : 'text',
      };
      if (selectedTemplate) {
        payload.templateName = selectedTemplate;
        payload.templateLanguage = 'es';
      } else {
        payload.body = customMessage;
      }
      return whatsappApi.sendMessage(payload);
    },
    onSuccess: () => {
      toast.success('WhatsApp message sent', { description: `To: ${recipient}` });
      setCustomMessage('');
    },
    onError: (err: Error) => {
      toast.error('Failed to send WhatsApp', { description: err.message });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> WhatsApp Quick Send
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Recipient (phone number)</Label>
          <Input
            type="tel"
            placeholder="+1234567890"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Template (optional)</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder={loadingTemplates ? 'Loading...' : 'Select template or type below...'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_custom">Custom message</SelectItem>
              {Array.isArray(templates) && templates.map((t: any) => (
                <SelectItem key={t.name || t.id} value={t.name || t.id}>
                  {t.name || t.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(!selectedTemplate || selectedTemplate === '_custom') && (
          <div className="space-y-2">
            <Label className="text-xs">Message</Label>
            <Textarea
              placeholder="Type your message..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        )}
        <Button
          className="w-full"
          onClick={() => sendMutation.mutate()}
          disabled={!recipient.trim() || (!selectedTemplate && !customMessage.trim()) || sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
          ) : (
            <><Send className="mr-2 h-4 w-4" /> Send WhatsApp</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function AskAionCard() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');

  const askMutation = useMutation({
    mutationFn: async () => {
      const result = await apiClient.post<{ data: { response?: string; message?: string; answer?: string } }>('/ai/chat', {
        message: question,
        context: 'operations_panel',
      });
      return result;
    },
    onSuccess: (result) => {
      const answer = (result as any)?.data?.response
        || (result as any)?.data?.message
        || (result as any)?.data?.answer
        || (result as any)?.response
        || (result as any)?.message
        || 'No response received.';
      setResponse(answer);
    },
    onError: (err: Error) => {
      toast.error('AI request failed', { description: err.message });
      setResponse('');
    },
  });

  const handleAsk = () => {
    if (!question.trim()) {
      toast.warning('Enter a question');
      return;
    }
    setResponse('');
    askMutation.mutate();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> Ask AION
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Question</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ask anything about the platform..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleAsk}
              disabled={!question.trim() || askMutation.isPending}
            >
              {askMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {askMutation.isPending && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">AION is thinking...</span>
          </div>
        )}
        {response && !askMutation.isPending && (
          <div className="p-3 rounded-md bg-muted/50 border border-border">
            <div className="flex items-start gap-2">
              <Bot className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm whitespace-pre-wrap">{response}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
