import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { DishCard, FromIngredientsRequest, FromIngredientsResponse, MealType } from "./types";

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

// Общий движок раздела 1 (§6.1, §8): один и тот же вызов для входа с фото
// (после подтверждения набора) и для ручного ввода без фото.
export function useDishesFromIngredients() {
  return useMutation({
    mutationFn: (body: FromIngredientsRequest) =>
      api.post<FromIngredientsResponse>("/api/dishes/from-ingredients", body),
  });
}
