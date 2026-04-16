import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LiveViewPreferences {
  qualityByCamera: Record<string, "main" | "sub">;
  aiOverlayDisabled: Set<string>;
  setQuality: (cameraId: string, quality: "main" | "sub") => void;
  toggleAiOverlay: (cameraId: string) => void;
  getQuality: (cameraId: string, gridSize: number) => "main" | "sub";
}

export const useLiveViewPreferencesStore = create<LiveViewPreferences>()(
  persist(
    (set, get) => ({
      qualityByCamera: {},
      aiOverlayDisabled: new Set<string>(),

      setQuality: (cameraId, quality) =>
        set((state) => ({
          qualityByCamera: { ...state.qualityByCamera, [cameraId]: quality },
        })),

      toggleAiOverlay: (cameraId) =>
        set((state) => {
          const next = new Set(state.aiOverlayDisabled);
          if (next.has(cameraId)) next.delete(cameraId);
          else next.add(cameraId);
          return { aiOverlayDisabled: next };
        }),

      getQuality: (cameraId, gridSize) => {
        const explicit = get().qualityByCamera[cameraId];
        if (explicit) return explicit;
        return gridSize >= 16 ? "sub" : "main";
      },
    }),
    {
      name: "aion-lv-prefs",
      partialize: (state) => ({
        qualityByCamera: state.qualityByCamera,
      }),
    },
  ),
);
