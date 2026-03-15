import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw,
  Timer, Eye, Zap, MapPin, Activity, Settings
} from 'lucide-react';

export type TourMode = 'section' | 'motion' | 'scheduled' | 'manual';

interface TourConfig {
  mode: TourMode;
  sectionId?: string;
  intervalSeconds: number;
  cameras: string[];
  isRunning: boolean;
  currentIndex: number;
}

interface TourEngineProps {
  cameras: Array<{ id: string; name: string; status: string; site_id: string }>;
  sections: Array<{ id: string; name: string }>;
  onCameraFocus: (cameraId: string) => void;
  onClose: () => void;
}

export default function TourEngine({ cameras, sections, onCameraFocus, onClose }: TourEngineProps) {
  const [config, setConfig] = useState<TourConfig>({
    mode: 'section',
    intervalSeconds: 8,
    cameras: [],
    isRunning: false,
    currentIndex: 0,
  });
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build camera list based on mode
  const tourCameras = useCallback(() => {
    const onlineCams = cameras.filter(c => c.status === 'online' || c.status === 'unknown');
    switch (config.mode) {
      case 'section':
        return selectedSection === 'all'
          ? onlineCams
          : onlineCams.filter(c => c.site_id === selectedSection);
      case 'motion':
        // Prioritize cameras — in a real system this would use event data
        // For now, shuffle to simulate motion-priority ordering
        return [...onlineCams].sort(() => Math.random() - 0.5);
      case 'scheduled':
      case 'manual':
      default:
        return onlineCams;
    }
  }, [cameras, config.mode, selectedSection]);

  const activeCameras = tourCameras();

  // Auto-cycling
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (config.isRunning && activeCameras.length > 0) {
      intervalRef.current = setInterval(() => {
        setConfig(prev => {
          const nextIndex = (prev.currentIndex + 1) % activeCameras.length;
          const cam = activeCameras[nextIndex];
          if (cam) onCameraFocus(cam.id);
          return { ...prev, currentIndex: nextIndex };
        });
      }, config.intervalSeconds * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [config.isRunning, config.intervalSeconds, activeCameras, onCameraFocus]);

  const toggleRunning = () => {
    if (!config.isRunning && activeCameras.length > 0) {
      onCameraFocus(activeCameras[config.currentIndex]?.id || activeCameras[0]?.id);
    }
    setConfig(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const skipNext = () => {
    const nextIndex = (config.currentIndex + 1) % activeCameras.length;
    setConfig(prev => ({ ...prev, currentIndex: nextIndex }));
    if (activeCameras[nextIndex]) onCameraFocus(activeCameras[nextIndex].id);
  };

  const skipPrev = () => {
    const prevIndex = config.currentIndex === 0 ? activeCameras.length - 1 : config.currentIndex - 1;
    setConfig(prev => ({ ...prev, currentIndex: prevIndex }));
    if (activeCameras[prevIndex]) onCameraFocus(activeCameras[prevIndex].id);
  };

  const reset = () => {
    setConfig(prev => ({ ...prev, currentIndex: 0, isRunning: false }));
    if (activeCameras[0]) onCameraFocus(activeCameras[0].id);
  };

  const modeLabels: Record<TourMode, { label: string; icon: React.ReactNode; desc: string }> = {
    section: { label: 'By Section', icon: <MapPin className="h-3 w-3" />, desc: 'Cycle cameras within a section/site' },
    motion: { label: 'By Motion', icon: <Activity className="h-3 w-3" />, desc: 'Prioritize cameras with recent activity' },
    scheduled: { label: 'Scheduled', icon: <Timer className="h-3 w-3" />, desc: 'Time-based automatic cycling' },
    manual: { label: 'Manual', icon: <Eye className="h-3 w-3" />, desc: 'Operator-controlled camera cycling' },
  };

  const currentCam = activeCameras[config.currentIndex];

  return (
    <div className="w-64 border-l bg-card flex flex-col shrink-0">
      <div className="p-2 border-b flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Zap className="h-3 w-3" /> Tour Engine
        </p>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onClose}>Hide</Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {/* Mode selection */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Tour Mode</p>
            <div className="space-y-1">
              {(Object.keys(modeLabels) as TourMode[]).map(mode => (
                <button
                  key={mode}
                  className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors text-xs ${config.mode === mode ? 'bg-primary/10 text-primary border border-primary/30' : 'hover:bg-muted/50 border border-transparent'}`}
                  onClick={() => setConfig(prev => ({ ...prev, mode, currentIndex: 0, isRunning: false }))}
                >
                  {modeLabels[mode].icon}
                  <div>
                    <p className="font-medium">{modeLabels[mode].label}</p>
                    <p className="text-[9px] text-muted-foreground">{modeLabels[mode].desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Section filter (for section mode) */}
          {config.mode === 'section' && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Section / Site</p>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Interval control */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Interval</p>
              <span className="text-[10px] font-mono text-primary">{config.intervalSeconds}s</span>
            </div>
            <Slider
              value={[config.intervalSeconds]}
              onValueChange={([val]) => setConfig(prev => ({ ...prev, intervalSeconds: val }))}
              min={3} max={30} step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
              <span>3s</span><span>30s</span>
            </div>
          </div>

          <Separator />

          {/* Playback controls */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Controls</p>
            <div className="flex items-center justify-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={skipPrev} disabled={activeCameras.length === 0}>
                <SkipBack className="h-3 w-3" />
              </Button>
              <Button
                variant={config.isRunning ? 'destructive' : 'default'}
                size="icon"
                className="h-10 w-10"
                onClick={toggleRunning}
                disabled={activeCameras.length === 0}
              >
                {config.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={skipNext} disabled={activeCameras.length === 0}>
                <SkipForward className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="p-2 rounded bg-muted/50 border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-muted-foreground uppercase">Status</span>
              <Badge variant={config.isRunning ? 'default' : 'secondary'} className="text-[8px]">
                {config.isRunning ? 'Running' : 'Paused'}
              </Badge>
            </div>
            <p className="text-[10px] font-medium">
              {currentCam ? currentCam.name : 'No camera selected'}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {config.currentIndex + 1} / {activeCameras.length} cameras • {modeLabels[config.mode].label}
            </p>
          </div>

          <Separator />

          {/* Camera queue */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
              Queue ({activeCameras.length})
            </p>
            <div className="space-y-0.5 max-h-40 overflow-auto">
              {activeCameras.map((cam, i) => (
                <button
                  key={cam.id}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[10px] transition-colors ${
                    i === config.currentIndex ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                  onClick={() => {
                    setConfig(prev => ({ ...prev, currentIndex: i }));
                    onCameraFocus(cam.id);
                  }}
                >
                  <span className="w-4 text-right font-mono text-[9px]">{i + 1}</span>
                  <span className="truncate">{cam.name}</span>
                </button>
              ))}
              {activeCameras.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-2">No cameras available</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
