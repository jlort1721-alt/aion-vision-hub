import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDevices } from '@/hooks/use-devices';
import { useSites } from '@/hooks/use-supabase-data'; // Sites still legacy for now
import { useSections } from '@/hooks/use-module-data';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import ErrorState from '@/components/ui/ErrorState';
import { GridLayout, Device } from '@/types';
import {
  Grid2x2, Grid3x3, Maximize, Volume2, Camera,
  Star, Save, RotateCcw, MonitorSpeaker, Wifi, WifiOff,
  Trash2, Loader2, GripVertical, X, Frame, FolderOpen, Bell, Navigation, Zap
} from 'lucide-react';

import LiveViewOpsPanel from '@/components/liveview/LiveViewOpsPanel';
import LiveViewEventsPanel from '@/components/liveview/LiveViewEventsPanel';
import TourEngine from '@/components/liveview/TourEngine';

import { WebRTCPlayer } from '@/components/video/WebRTCPlayer';
import { Go2RTCPlayer } from '@/components/video/Go2RTCPlayer';

const GRID_OPTIONS: { grid: GridLayout; label: string; icon: React.ReactNode }[] = [
  { grid: 1, label: '1×1', icon: <Maximize className="h-4 w-4" /> },
  { grid: 4, label: '2×2', icon: <Grid2x2 className="h-4 w-4" /> },
  { grid: 9, label: '3×3', icon: <Grid3x3 className="h-4 w-4" /> },
  { grid: 16, label: '4×4', icon: <Grid3x3 className="h-4 w-4" /> },
  { grid: 25, label: '5×5', icon: <Grid3x3 className="h-4 w-4" /> },
  { grid: 36, label: '6×6', icon: <Grid3x3 className="h-4 w-4" /> },
];

function CameraCell({
  device, index, onDrop, onDragStart, onRemove, isDragOver,
}: {
  device?: Device; index: number;
  onDrop: (index: number) => void;
  onDragStart: (device: Device) => void;
  onRemove: (index: number) => void;
  isDragOver: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleCapture = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!device) return;
    const video = document.querySelector(`[data-camera-id="${device.id}"] video`) as HTMLVideoElement;
    if (!video) { toast.error('No video stream available'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { toast.error('Failed to capture frame'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fileName = `snapshot_${device.name}_${ts}.jpg`;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Snapshot saved', { description: fileName });
    }, 'image/jpeg', 0.95);
  }, [device]);

  if (!device) {
    return (
      <div
        className={`bg-muted/20 rounded-md border border-dashed flex items-center justify-center transition-all ${isDragOver ? 'border-primary bg-primary/20 scale-[1.02] shadow-primary/20 shadow-lg' : 'border-border'}`}
        onDragOver={handleDragOver}
        onDrop={(e) => { e.preventDefault(); onDrop(index); }}
        aria-label={`Empty camera slot ${index + 1}, drop a camera here`}
      >
        <div className="text-center text-muted-foreground delay-75 duration-300">
          <Camera className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-xs font-medium tracking-tight opacity-50">SLOT {index + 1}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-black rounded-md border border-border/50 overflow-hidden group cursor-grab active:cursor-grabbing transition-all ${isDragOver ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:border-primary/50'} shadow-sm`}
      draggable
      onDragStart={() => onDragStart(device)}
      onDragOver={handleDragOver}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Camera: ${device.name}, status: ${device.status}`}
    >
      <div className="absolute inset-0 z-0 bg-zinc-950 flex items-center justify-center" data-camera-id={device.id}>
        <Go2RTCPlayer
          streamName={(device as unknown as Record<string, unknown>).device_slug as string || device.id}
          cameraName={device.name}
          controls={false}
        />
      </div>

      <div className={`absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-80'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-3.5 w-3.5 text-white/40 group-hover:text-white/80 transition-colors" />
            <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.8)] ${device.status === 'online' ? 'bg-success shadow-success/50' : 'bg-destructive shadow-destructive/50'}`} />
            <span className="text-xs font-semibold text-white tracking-wide truncate max-w-[120px] drop-shadow-md">{device.name}</span>
          </div>
          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4 text-white/90 border-white/20 bg-black/50 backdrop-blur-sm uppercase tracking-wider">{device.brand}</Badge>
        </div>
      </div>

      {hovered && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 p-2 bg-gradient-to-t from-black/95 via-black/80 to-transparent animate-in slide-in-from-bottom-2 duration-200">
          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-sm bg-white/10 hover:bg-white/25 text-white border-none shadow-none" aria-label="Fullscreen"><Maximize className="h-3.5 w-3.5" /></Button>
          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-sm bg-white/10 hover:bg-white/25 text-white border-none shadow-none" aria-label="Toggle audio"><Volume2 className="h-3.5 w-3.5" /></Button>
          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-sm bg-white/10 hover:bg-white/25 text-white border-none shadow-none" onClick={handleCapture} aria-label="Capture snapshot"><Frame className="h-3.5 w-3.5" /></Button>
          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-sm bg-white/10 hover:bg-white/25 text-white border-none shadow-none" aria-label="Refresh stream"><RotateCcw className="h-3.5 w-3.5" /></Button>
          <div className="ml-auto">
            <Button variant="destructive" size="icon" className="h-7 w-7 rounded-sm shadow-none opacity-80 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onRemove(index); }} aria-label="Remove camera from slot">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {device.status === 'online' && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-[pulse_1.5s_ease-in-out_infinite]" />
          <span className="text-[9px] text-white/90 font-mono font-medium tracking-widest">LIVE</span>
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
  // Slot assignments: index → deviceContext_id
  const [slotAssignments, setSlotAssignments] = useState<Record<number, string>>({});
  const [draggedDevice, setDraggedDevice] = useState<Device | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);

  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: devices = [], isLoading, isError, error, refetch } = useDevices();
  const { data: sites = [] } = useSites();
  const { data: sections = [] } = useSections();

  const allCameras = useMemo(() => {
    return (devices || []).filter(d =>
      d.type === 'camera' && (selectedSite === 'all' || d.site_id === selectedSite)
    );
  }, [devices, selectedSite]);

  // Build the grid: use slot assignments if any, else fallback to sequential
  const getDeviceForSlot = useCallback((index: number): Device | undefined => {
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

  const handleDragStartFromSidebar = (device: Device) => {
    setDraggedDevice(device);
  };

  const handleDragStartFromGrid = (device: Device) => {
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
    queryFn: () => apiClient.get<Record<string, unknown>[]>('/live-view/layouts'),
    enabled: !!profile,
  });

  const saveLayout = useMutation({
    mutationFn: async () => {
      if (!profile || !user) throw new Error('Not authenticated');
      const slots = Object.entries(slotAssignments).map(([pos, deviceId]) => ({
        position: Number(pos),
        device_id: deviceId,
      }));
      await apiClient.post('/live-view/layouts', {
        name: layoutName,
        grid,
        slots,
        isShared,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_view_layouts'] });
      toast.success('Layout saved securely via API');
      setSaveDialogOpen(false);
      setLayoutName('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLayout = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete('/live-view/layouts/' + id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_view_layouts'] });
      toast.success('Layout deleted');
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      await apiClient.patch('/live-view/layouts/' + id + '/favorite', {
        isFavorite: !current,
      });
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

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

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
            <SelectTrigger className="w-48 h-8 text-xs" aria-label="Filter by site"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center border rounded-md" role="group" aria-label="Grid layout options">
            {GRID_OPTIONS.map(opt => (
              <Button
                key={opt.grid}
                variant={grid === opt.grid ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-2 rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => setGrid(opt.grid)}
                aria-label={`${opt.label} grid layout`}
                aria-pressed={grid === opt.grid}
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
            <Button
              variant="default"
              size="sm"
              className="h-8 text-xs bg-cyan-500 hover:bg-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
              onClick={() => { window.location.href = '/immersive' }}
            >
              <Zap className="mr-1 h-3 w-3" /> Immersive 3D
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
