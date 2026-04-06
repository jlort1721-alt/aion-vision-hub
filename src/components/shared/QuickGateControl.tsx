import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDevices } from '@/hooks/use-api-data';
import { useMutation } from '@tanstack/react-query';
import { deviceControlApi } from '@/services/device-control-api';
import { toast } from 'sonner';
import { DoorOpen, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface QuickGateControlProps {
  /** Compact mode for dashboard cards */
  compact?: boolean;
  /** Pre-selected device ID */
  deviceId?: string;
  /** Class name for the trigger button */
  className?: string;
}

export default function QuickGateControl({ compact = false, deviceId, className }: QuickGateControlProps) {
  const [open, setOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(deviceId || '');
  const [reason, setReason] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  const { data: devices = [] } = useDevices();

  // Filter devices that likely support door/gate control (access_control type or intercom)
  const gateDevices = devices.filter(
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
  );

  const openGateMutation = useMutation({
    mutationFn: () => deviceControlApi.openGate(selectedDevice, reason || 'Manual gate open'),
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
      handleClose();
    },
    onError: (err: Error) => {
      toast.error('Error opening gate', { description: err.message });
    },
  });

  const handleClose = () => {
    setOpen(false);
    setConfirmStep(false);
    setReason('');
    if (!deviceId) setSelectedDevice('');
  };

  const handleOpenGate = () => {
    if (!selectedDevice) {
      toast.warning('Select a device first');
      return;
    }
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }
    openGateMutation.mutate();
  };

  return (
    <>
      <Button
        variant={compact ? 'outline' : 'default'}
        size={compact ? 'sm' : 'default'}
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Open gate control"
      >
        <DoorOpen className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
        {!compact && 'Open Gate'}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" />
              Quick Gate Control
            </DialogTitle>
            <DialogDescription>
              Send an open command to an access control device. This action is audited.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Device</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gate/door device..." />
                </SelectTrigger>
                <SelectContent>
                  {gateDevices.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No gate devices online
                    </SelectItem>
                  ) : (
                    gateDevices.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-success' : 'bg-destructive'}`}
                          />
                          {d.name}
                          <span className="text-xs text-muted-foreground ml-1">({d.ip_address})</span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {gateDevices.length === 0 && devices.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  No devices matching gate/door/access criteria are online. All online devices:
                </p>
              )}
            </div>

            {/* If no gate-specific devices, show all online devices as fallback */}
            {gateDevices.length === 0 && devices.filter((d) => d.status === 'online').length > 0 && (
              <div className="space-y-2">
                <Label>All Online Devices</Label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select any device..." />
                  </SelectTrigger>
                  <SelectContent>
                    {devices
                      .filter((d) => d.status === 'online')
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.ip_address})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                placeholder="e.g. Visitor arrival, delivery, emergency..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {confirmStep && (
              <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Confirm gate opening</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will send an open command to{' '}
                    <strong>{gateDevices.find((d) => d.id === selectedDevice)?.name || 'the selected device'}</strong>.
                    This action is logged and audited.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={handleClose} aria-label="Cancel gate control">
              Cancel
            </Button>
            <Button
              variant={confirmStep ? 'destructive' : 'default'}
              onClick={handleOpenGate}
              disabled={!selectedDevice || openGateMutation.isPending}
              aria-label={confirmStep ? 'Confirm gate opening' : 'Open gate'}
            >
              {openGateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening...
                </>
              ) : confirmStep ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Open
                </>
              ) : (
                <>
                  <DoorOpen className="mr-2 h-4 w-4" /> Open Gate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
