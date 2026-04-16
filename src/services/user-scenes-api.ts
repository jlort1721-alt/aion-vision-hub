import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

interface SceneWidget {
  type: "camera" | "door" | "intercom" | "iot" | "events";
  deviceId?: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  config?: Record<string, unknown>;
}

export interface UserScene {
  id: string;
  name: string;
  layout: SceneWidget[];
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateSceneInput {
  name: string;
  layout: SceneWidget[];
  isShared?: boolean;
}

export function useUserScenes() {
  return useQuery({
    queryKey: ["user-scenes"],
    queryFn: async () => {
      const res = await apiClient.get("/user-scenes");
      return (res as { data: UserScene[] }).data;
    },
    staleTime: 60_000,
  });
}

export function useUserScene(id: string | null) {
  return useQuery({
    queryKey: ["user-scenes", id],
    queryFn: async () => {
      const res = await apiClient.get(`/user-scenes/${id}`);
      return (res as { data: UserScene }).data;
    },
    enabled: !!id,
  });
}

export function useCreateScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSceneInput) => {
      const res = await apiClient.post("/user-scenes", input);
      return (res as { data: UserScene }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-scenes"] }),
  });
}

export function useUpdateScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreateSceneInput> & { id: string }) => {
      const res = await apiClient.put(`/user-scenes/${id}`, input);
      return (res as { data: UserScene }).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-scenes"] }),
  });
}

export function useDeleteScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/user-scenes/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-scenes"] }),
  });
}
