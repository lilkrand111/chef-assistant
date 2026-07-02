import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { DishCard, MealType } from "./types";

export function useDishes(params: { mealType?: MealType; search?: string }) {
  const query = new URLSearchParams();
  if (params.mealType) query.set("mealType", params.mealType);
  if (params.search) query.set("search", params.search);
  const qs = query.toString();

  return useQuery({
    queryKey: ["dishes", params.mealType ?? null, params.search ?? ""],
    queryFn: () => api.get<DishCard[]>(`/api/dishes${qs ? `?${qs}` : ""}`),
  });
}

export function useDish(id: string | undefined) {
  return useQuery({
    queryKey: ["dish", id],
    queryFn: () => api.get<DishCard>(`/api/dishes/${id}`),
    enabled: Boolean(id),
  });
}
