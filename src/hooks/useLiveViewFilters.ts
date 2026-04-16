import { useState, useMemo, useCallback } from "react";

interface Camera {
  id: string;
  name: string;
  status: string;
  site_id?: string;
  site_name?: string;
}

interface SiteGroup {
  site_id: string;
  site_name: string;
  cameras: Camera[];
}

interface UseLiveViewFiltersParams {
  allCameras: Camera[];
  siteGroups: SiteGroup[];
}

export function useLiveViewFilters({
  allCameras,
  siteGroups,
}: UseLiveViewFiltersParams) {
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenCameras, setHiddenCameras] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<
    "all" | "online" | "offline"
  >("all");

  const filteredCameras = useMemo(() => {
    const base =
      selectedSite === "all"
        ? allCameras
        : (siteGroups.find((sg) => sg.site_id === selectedSite)?.cameras ?? []);

    return [...base]
      .filter((c) => !hiddenCameras.has(c.id))
      .filter((c) => {
        if (statusFilter === "online") return c.status === "online";
        if (statusFilter === "offline") return c.status !== "online";
        return true;
      })
      .filter((c) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.site_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.status === "online" && b.status !== "online") return -1;
        if (a.status !== "online" && b.status === "online") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [
    allCameras,
    siteGroups,
    selectedSite,
    hiddenCameras,
    statusFilter,
    searchQuery,
  ]);

  const toggleHideCamera = useCallback((cameraId: string) => {
    setHiddenCameras((prev) => {
      const next = new Set(prev);
      if (next.has(cameraId)) next.delete(cameraId);
      else next.add(cameraId);
      return next;
    });
  }, []);

  return {
    selectedSite,
    setSelectedSite,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    hiddenCameras,
    toggleHideCamera,
    filteredCameras,
  };
}
