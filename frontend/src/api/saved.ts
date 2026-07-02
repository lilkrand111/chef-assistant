import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { DishCard } from "./types";

export function useSaved() {
  return useQuery({ queryKey: ["saved"], queryFn: () => api.get<DishCard[]>("/api/saved") });
}

export function useSaveDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dishId: string) => api.post<{ ok: true }>("/api/saved", { dishId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved"] }),
  });
}

export function useUnsaveDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dishId: string) => api.delete<{ ok: true }>(`/api/saved/${dishId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved"] }),
  });
}
