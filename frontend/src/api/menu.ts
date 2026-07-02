import { useMutation } from "@tanstack/react-query";
import { api } from "./client";
import type { MenuGenerateRequest, MenuPlan, MenuReplaceMealRequest } from "./types";

export function useGenerateMenu() {
  return useMutation({
    mutationFn: (body: MenuGenerateRequest) => api.post<MenuPlan>("/api/menu/generate", body),
  });
}

export function useReplaceMenuMeal() {
  return useMutation({
    mutationFn: (body: MenuReplaceMealRequest) => api.post<MenuPlan>("/api/menu/replace-meal", body),
  });
}
