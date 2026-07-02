import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Ingredient } from "./types";

export interface IngredientSearchOptions {
  // true — только ингредиенты с КБЖУ (для подбора блюд по продуктам, §6.1);
  // без опции — без фильтра (для списка покупок, §6.4, где категорийные
  // ингредиенты — штатный случай).
  hasNutrition?: boolean;
}

export function useIngredientSearch(search: string, options: IngredientSearchOptions = {}) {
  const { hasNutrition } = options;
  return useQuery({
    queryKey: ["ingredients", search, hasNutrition ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ search });
      if (hasNutrition !== undefined) params.set("hasNutrition", String(hasNutrition));
      return api.get<Ingredient[]>(`/api/ingredients?${params.toString()}`);
    },
    enabled: search.trim().length > 0,
  });
}
