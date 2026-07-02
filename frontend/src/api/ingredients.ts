import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Ingredient } from "./types";

export function useIngredientSearch(search: string) {
  return useQuery({
    queryKey: ["ingredients", search],
    queryFn: () => api.get<Ingredient[]>(`/api/ingredients?search=${encodeURIComponent(search)}`),
    enabled: search.trim().length > 0,
  });
}
