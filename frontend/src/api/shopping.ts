import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { ShoppingGroup, ShoppingItem } from "./types";

export function useShopping(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["shopping"],
    queryFn: () => api.get<{ groups: ShoppingGroup[] }>("/api/shopping"),
    enabled: options?.enabled ?? true,
  });
}

export function useAddShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ingredientId?: string; name?: string; amount?: number; unit?: string }) =>
      api.post<ShoppingItem>("/api/shopping/item", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useAddFromDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dishId, ingredientIds, scale }: { dishId: string; ingredientIds?: string[]; scale?: number }) =>
      api.post<{ added: number }>(`/api/shopping/from-dish/${dishId}`, { ingredientIds, scale }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function usePatchShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; checked?: boolean; amount?: number; unit?: string }) =>
      api.patch<ShoppingItem>(`/api/shopping/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/api/shopping/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useClearShopping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ ok: true }>("/api/shopping"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}
