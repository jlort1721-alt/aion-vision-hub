import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

interface CameraLink {
  id: string;
  cameraId: string;
  linkedDeviceId: string;
  linkType: "intercom" | "door" | "iot_relay" | "sensor";
  priority: number;
  createdAt: string;
  deviceName: string | null;
  deviceStatus: string | null;
}

interface CreateLinkInput {
  cameraId: string;
  linkedDeviceId: string;
  linkType: CameraLink["linkType"];
  priority?: number;
}

export function useCameraLinks(cameraId: string | null) {
  return useQuery({
    queryKey: ["camera-links", cameraId],
    queryFn: async () => {
      const res = await apiClient.get(`/camera-links/${cameraId}`);
      return (res as { data: CameraLink[] }).data;
    },
    enabled: !!cameraId,
    staleTime: 60_000,
  });
}

export function useCreateCameraLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLinkInput) => {
      const res = await apiClient.post("/camera-links", input);
      return (res as { data: CameraLink }).data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["camera-links", vars.cameraId] });
    },
  });
}

export function useDeleteCameraLink(cameraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      await apiClient.delete(`/camera-links/${linkId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["camera-links", cameraId] });
    },
  });
}
