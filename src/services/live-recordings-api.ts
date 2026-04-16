import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export interface LiveRecording {
  id: string;
  cameraId: string;
  startedBy: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  storageUrl: string | null;
  status: "pending" | "recording" | "uploading" | "ready" | "failed";
  reason: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}

interface StartRecordingInput {
  cameraId: string;
  durationSec?: number;
  reason: string;
}

export function useLiveRecordings(cameraId?: string) {
  return useQuery({
    queryKey: ["live-recordings", cameraId],
    queryFn: async () => {
      const qs = cameraId ? `?camera_id=${cameraId}` : "";
      const res = await apiClient.get(`/live-recordings${qs}`);
      return (res as { data: LiveRecording[] }).data;
    },
    staleTime: 10_000,
  });
}

export function useLiveRecording(id: string | null) {
  return useQuery({
    queryKey: ["live-recordings", "detail", id],
    queryFn: async () => {
      const res = await apiClient.get(`/live-recordings/${id}`);
      return (res as { data: LiveRecording }).data;
    },
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === "ready" ||
      query.state.data?.status === "failed"
        ? false
        : 3000,
  });
}

export function useStartRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StartRecordingInput) => {
      const res = await apiClient.post("/live-recordings/start", input);
      return (res as { data: LiveRecording }).data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["live-recordings", vars.cameraId],
      });
    },
  });
}
