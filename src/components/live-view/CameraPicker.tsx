import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Video,
  Image,
  Search,
  CheckSquare,
  Square,
  Monitor,
} from "lucide-react";
import type { CameraDisplayMode } from "@/components/video/SmartCameraCell";

interface CameraItem {
  id: string;
  name: string;
  stream_key: string;
  status: string;
  site_name?: string;
  site_id?: string;
}

interface SiteGroup {
  site_id: string;
  site_name: string;
  cameras: CameraItem[];
}

interface CameraPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteGroups: SiteGroup[];
  hiddenCameras: Set<string>;
  cameraModes: Map<string, CameraDisplayMode>;
  onToggleVisibility: (cameraId: string) => void;
  onToggleMode: (cameraId: string, mode: CameraDisplayMode) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onAllVideo: () => void;
  onAllSnapshot: () => void;
}

export function CameraPicker({
  open,
  onOpenChange,
  siteGroups,
  hiddenCameras,
  cameraModes,
  onToggleVisibility,
  onToggleMode,
  onShowAll,
  onHideAll,
  onAllVideo,
  onAllSnapshot,
}: CameraPickerProps) {
  const [search, setSearch] = useState("");

  const allCameras = useMemo(
    () => siteGroups.flatMap((sg) => sg.cameras),
    [siteGroups],
  );

  const visibleCount = allCameras.filter(
    (c) => !hiddenCameras.has(c.id),
  ).length;
  const totalCount = allCameras.length;

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return siteGroups;
    const q = search.toLowerCase();
    return siteGroups
      .map((sg) => ({
        ...sg,
        cameras: sg.cameras.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            sg.site_name.toLowerCase().includes(q),
        ),
      }))
      .filter((sg) => sg.cameras.length > 0);
  }, [siteGroups, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Selector de Cámaras
            <Badge variant="secondary" className="ml-auto text-xs">
              {visibleCount}/{totalCount} visibles
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cámara o sitio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onShowAll}
          >
            <CheckSquare className="h-3 w-3" />
            Mostrar todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onHideAll}
          >
            <Square className="h-3 w-3" />
            Ocultar todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onAllVideo}
          >
            <Video className="h-3 w-3 text-green-500" />
            Todo video
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onAllSnapshot}
          >
            <Image className="h-3 w-3 text-yellow-500" />
            Todo snapshot
          </Button>
        </div>

        {/* Camera list grouped by site */}
        <ScrollArea className="flex-1 -mx-1">
          <div className="space-y-3 px-1">
            {filteredGroups.map((sg) => (
              <div key={sg.site_id}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                  {sg.site_name} ({sg.cameras.length})
                </p>
                <div className="space-y-0.5">
                  {sg.cameras.map((cam) => {
                    const isHidden = hiddenCameras.has(cam.id);
                    const camMode = cameraModes.get(cam.id) ?? "auto";
                    const isOnline =
                      cam.status === "online" || cam.status === "active";

                    return (
                      <div
                        key={cam.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                          isHidden
                            ? "opacity-40 bg-muted/20"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        {/* Visibility toggle */}
                        <button
                          className="shrink-0"
                          onClick={() => onToggleVisibility(cam.id)}
                          title={isHidden ? "Mostrar" : "Ocultar"}
                        >
                          {isHidden ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-primary" />
                          )}
                        </button>

                        {/* Status dot + name */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isOnline ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        <span className="text-xs truncate flex-1">
                          {cam.name}
                        </span>

                        {/* Mode toggle */}
                        <button
                          className={`shrink-0 p-1 rounded transition-colors ${
                            camMode === "snapshot"
                              ? "bg-yellow-500/20 text-yellow-500"
                              : camMode === "video"
                                ? "bg-green-500/20 text-green-500"
                                : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => {
                            const next: CameraDisplayMode =
                              camMode === "video"
                                ? "snapshot"
                                : camMode === "snapshot"
                                  ? "auto"
                                  : "video";
                            onToggleMode(cam.id, next);
                          }}
                          title={
                            camMode === "video"
                              ? "Video en vivo (click → snapshot)"
                              : camMode === "snapshot"
                                ? "Snapshot (click → auto)"
                                : "Auto (click → video)"
                          }
                        >
                          {camMode === "snapshot" ? (
                            <Image className="h-3.5 w-3.5" />
                          ) : camMode === "video" ? (
                            <Video className="h-3.5 w-3.5" />
                          ) : (
                            <Monitor className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Sin resultados para &quot;{search}&quot;
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
