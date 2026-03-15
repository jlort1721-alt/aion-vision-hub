import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDevices, useSites } from '@/hooks/use-supabase-data';
import { useSections } from '@/hooks/use-module-data';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GridLayout } from '@/types';
import {
  Grid2x2, Grid3x3, Maximize, Volume2, Camera,
  Star, Save, RotateCcw, MonitorSpeaker, Wifi, WifiOff,
  Trash2, Loader2, FolderOpen, GripVertical, X,
  Zap, Bell, Navigation
} from 'lucide-react';

import LiveViewOpsPanel from '@/components/liveview/LiveViewOpsPanel';
import LiveViewEventsPanel from '@/components/liveview/LiveViewEventsPanel';
import TourEngine from '@/components/liveview/TourEngine';

const GRID_OPTIONS: { grid: GridLayout; label: string; icon: React.ReactNode }[] = [
  { grid: 1, label: '1×1', icon: <Maximize className="h-4 w-4" /> },
  { grid: 4, label: '2×2', icon: <Grid2x2 className="h-4 w-4" /> },
  { grid: 9, label: '3×3', icon: <Grid3x3 className="h-4 w-4" /> },
  { grid: 16, label: '4×4', icon: <Grid3x3 className="h-4 w-4" /> },
  { grid: 25, label: '5×5', icon: <Grid3x3 className="h-4 w-4" /> },
  { grid: 36, label: '6×6', icon: <Grid3x3 className="h-4 w-4" /> },
];

type DeviceRow = {
  id: string; name: string; type: string; brand: string; model: string;
  ip_address: string; rtsp_port: number | null; status: string;
  site_id: string;
};

function CameraCell({
  device, index, onDrop, onDragStart, onRemove, isDragOver,
}: {
  device?: DeviceRow; index: number;
  onDrop: (index: number) => void;
  onDragStart: (device: DeviceRow) => void;
  onRemove: (index: number) => void;
  isDragOver: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  if (!device) {
    return (
      <div
        className={`bg-muted/30 rounded-md border border-dashed flex items-center justify-center transition-colors ${isDragOver ? 'border-primary bg-primary/10' : 'border-border'}`}
        onDragOver={handleDragOver}
        onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      >
        <div className="text-center text-muted-foreground">
          <Camera className="h-6 w-6 mx-auto mb-1 opacity-30" />
          <p className="text-[10px]">Slot {index + 1} — Drop camera here</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-card rounded-md border overflow-hidden group cursor-grab active:cursor-grabbing transition-colors ${isDragOver ? 'border-primary' : ''}`}
      draggable
      onDragStart={() => onDragStart(device)}
      onDragOver={handleDragOver}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-muted/80 via-muted to-muted/60 flex items-center justify-center">
        <div className="text-center">
          <MonitorSpeaker className="h-8 w-8 mx-auto mb-1 text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            {device.ip_address}:{device.rtsp_port || 554}
          </p>
          <p className="text-[9px] text-muted-foreground/40 mt-0.5">
            {device.brand === 'hikvision' ? 'RTSP/ISAPI' : 'RTSP/HTTP'} • Substream
          </p>
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-1.5 bg-gradient-to-b from-background/70 to-transparent">
        <div className="flex items-center gap-1">
          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
          {device.status === 'online' ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3 text-destructive" />}
          <span className="text-[10px] font-medium text-foreground">{device.name}</span>
        </div>
        <Badge variant="outline" className="text-[8px] h-4 px-1">{device.brand}</Badge>
      </div>

      {hovered && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 p-1.5 bg-gradient-to-t from-background/70 to-transparent">
          <Button variant="ghost" size="icon" className="h-6 w-6"><Maximize className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6"><Volume2 className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6"><Camera className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6"><RotateCcw className="h-3 w-3" /></Button>
          <div className="ml-auto">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(index); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {device.status === 'online' && (
        <div className="absolute top-1.5 right-1.5">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-[8px] text-destructive font-mono font-bold">REC</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default function LiveViewPage() {
  const [grid, setGrid] = useState<GridLayout>(9);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [opsOpen, setOpsOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  // Slot assignments: index → device_id
  const [slotAssignments, setSlotAssignments] = useState<Record<number, string>>({});
  const [draggedDevice, setDraggedDevice] = useState<DeviceRow | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);

  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: devices = [], isLoading } = useDevices();
  const { data: sites = [] } = useSites();
  const { data: sections = [] } = useSections();

  const allCameras = devices.filter(d =>
    d.type === 'camera' && (selectedSite === 'all' || d.site_id === selectedSite)
  );

  // Build the grid: use slot assignments if any, else fallback to sequential
  const getDeviceForSlot = useCallback((index: number): DeviceRow | undefined => {
    const assignedId = slotAssignments[index];
    if (assignedId) {
      return allCameras.find(c => c.id === assignedId);
    }
    // If no assignments exist at all, show sequential cameras
    if (Object.keys(slotAssignments).length === 0) {
      return allCameras[index];
    }
    return undefined;
  }, [slotAssignments, allCameras]);

  const handleDragStartFromSidebar = (device: DeviceRow) => {
    setDraggedDevice(device);
  };

  const handleDragStartFromGrid = (device: DeviceRow) => {
    setDraggedDevice(device);
  };

  const handleDrop = useCallback((targetSlot: number) => {
    if (!draggedDevice) return;
    setSlotAssignments(prev => {
      const next = { ...prev };
      // Remove device from any existing slot
      Object.entries(next).forEach(([key, val]) => {
        if (val === draggedDevice.id) delete next[Number(key)];
      });
      // If there was already a device in target, swap
      // Assign dragged device to target
      next[targetSlot] = draggedDevice.id;
      return next;
    });
    setDraggedDevice(null);
    setDragOverSlot(null);
  }, [draggedDevice]);

  const handleRemoveFromSlot = (index: number) => {
    setSlotAssignments(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Unassigned cameras for sidebar
  const assignedIds = new Set(Object.values(slotAssignments));
  const unassignedCameras = allCameras.filter(c => !assignedIds.has(c.id));

  // Saved layouts
  const { data: savedLayouts = [] } = useQuery({
    queryKey: ['live_view_layouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_view_layouts' as any)
        .select('*')
        .order('is_favorite', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!profile,
  });

  const saveLayout = useMutation({
    mutationFn: async () => {
      if (!profile || !user) throw new Error('Not authenticated');
      const slots = Array.from({ length: grid }).map((_, i) => {
        const deviceId = slotAssignments[i] || (Object.keys(slotAssignments).length === 0 ? allCameras[i]?.id : undefined);
        return {
          position: i,
          device_id: deviceId || null,
          channel: 1,
          stream_type: 'sub',
        };
      });
      const { error } = await supabase.from('live_view_layouts' as any).insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        name: layoutName,
        grid,
        slots,
        is_shared: isShared,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_view_layouts'] });
      toast.success('Layout saved');
      setSaveDialogOpen(false);
      setLayoutName('');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteLayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('live_view_layouts' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_view_layouts'] });
      toast.success('Layout deleted');
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      const { error } = await supabase.from('live_view_layouts' as any).update({ is_favorite: !current } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['live_view_layouts'] }),
  });

  const loadLayout = (layout: any) => {
    setGrid(layout.grid as GridLayout);
    // Restore slot assignments from saved layout
    const newAssignments: Record<number, string> = {};
    const slots = layout.slots as any[];
    if (slots?.length) {
      slots.forEach((slot: any) => {
        if (slot.device_id) {
          newAssignments[slot.position] = slot.device_id;
        }
      });
    }
    setSlotAssignments(newAssignments);
    setLoadDialogOpen(false);
    toast.success(`Layout "${layout.name}" loaded`);
  };

  const cols = Math.sqrt(grid);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Camera sidebar */}
      <div className="w-56 border-r bg-card flex flex-col shrink-0">
        <div className="p-2 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cameras</p>
          <p className="text-[10px] text-muted-foreground">{unassignedCameras.length} available — drag to grid</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1 space-y-0.5">
            {allCameras.map(cam => (
              <div
                key={cam.id}
                className={`flex items-center gap-2 p-2 rounded-md cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors ${assignedIds.has(cam.id) ? 'opacity-40' : ''}`}
                draggable={!assignedIds.has(cam.id)}
                onDragStart={() => handleDragStartFromSidebar(cam)}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                {cam.status === 'online' ? <Wifi className="h-3 w-3 text-success shrink-0" /> : <WifiOff className="h-3 w-3 text-destructive shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium truncate">{cam.name}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{cam.ip_address} • {cam.brand}</p>
                </div>
              </div>
            ))}
            {allCameras.length === 0 && (
              <p className="text-xs text-muted-foreground p-3 text-center">No cameras found</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main grid area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-card">
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center border rounded-md">
            {GRID_OPTIONS.map(opt => (
              <Button
                key={opt.grid}
                variant={grid === opt.grid ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-2 rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => setGrid(opt.grid)}
              >
                {opt.icon}
                <span className="ml-1 text-xs">{opt.label}</span>
              </Button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={tourOpen ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setTourOpen(!tourOpen); if (!tourOpen) { setEventsOpen(false); setOpsOpen(false); } }}
            >
              <Navigation className="mr-1 h-3 w-3" /> Tours
            </Button>
            <Button
              variant={eventsOpen ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setEventsOpen(!eventsOpen); if (!eventsOpen) { setTourOpen(false); } }}
            >
              <Bell className="mr-1 h-3 w-3" /> Events
            </Button>
            {!opsOpen && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setOpsOpen(true); setTourOpen(false); }}>Ops Panel</Button>
            )}
            <Badge variant="outline" className="text-xs">{allCameras.length} cameras</Badge>

            <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8"><FolderOpen className="mr-1 h-3 w-3" /> Load</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Saved Layouts</DialogTitle></DialogHeader>
                {savedLayouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No saved layouts yet</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {savedLayouts.map((layout: any) => (
                      <div key={layout.id} className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/50">
                        <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => loadLayout(layout)}>
                          <div>
                            <p className="text-sm font-medium">{layout.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {Math.sqrt(layout.grid)}×{Math.sqrt(layout.grid)} grid
                              {layout.is_shared && ' • Shared'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFavorite.mutate({ id: layout.id, current: layout.is_favorite })}>
                            <Star className={`h-3.5 w-3.5 ${layout.is_favorite ? 'fill-warning text-warning' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLayout.mutate(layout.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8"><Save className="mr-1 h-3 w-3" /> Save Layout</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Save Current Layout</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Layout Name</Label>
                    <Input value={layoutName} onChange={e => setLayoutName(e.target.value)} placeholder="e.g. Main Entrance 3x3" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Share with team</p>
                      <p className="text-xs text-muted-foreground">Other operators can load this layout</p>
                    </div>
                    <Switch checked={isShared} onCheckedChange={setIsShared} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Grid: {Math.sqrt(grid)}×{Math.sqrt(grid)} • {Object.keys(slotAssignments).length || Math.min(allCameras.length, grid)} cameras assigned
                  </p>
                  <Button className="w-full" onClick={() => saveLayout.mutate()} disabled={!layoutName.trim() || saveLayout.isPending}>
                    {saveLayout.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                    Save Layout
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex-1 p-2">
          {isLoading ? (
            <div className="grid gap-1 h-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${cols}, 1fr)` }}>
              {Array.from({ length: grid }).map((_, i) => <Skeleton key={i} className="rounded-md" />)}
            </div>
          ) : (
            <div className="grid gap-1 h-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${cols}, 1fr)` }}>
              {Array.from({ length: grid }).map((_, i) => (
                <CameraCell
                  key={i}
                  device={getDeviceForSlot(i)}
                  index={i}
                  onDrop={handleDrop}
                  onDragStart={handleDragStartFromGrid}
                  onRemove={handleRemoveFromSlot}
                  isDragOver={dragOverSlot === i}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {tourOpen && (
        <TourEngine
          cameras={allCameras}
          sections={[...sites.map(s => ({ id: s.id, name: s.name })), ...sections.map((s: any) => ({ id: s.id, name: s.name }))]}
          onCameraFocus={(camId) => {
            setFocusedCameraId(camId);
            // Auto-assign to slot 0 for 1x1, or highlight in grid
            if (grid === 1) {
              setSlotAssignments({ 0: camId });
            }
          }}
          onClose={() => setTourOpen(false)}
        />
      )}
      {eventsOpen && <LiveViewEventsPanel onClose={() => setEventsOpen(false)} />}
      {opsOpen && !tourOpen && <LiveViewOpsPanel onClose={() => setOpsOpen(false)} />}
    </div>
  );
}
