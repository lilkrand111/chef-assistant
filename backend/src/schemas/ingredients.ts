import { z } from "zod";

export const ingredientQuerySchema = z.object({
  search: z.string().trim().optional(),
  // Фильтр по Ingredient.hasNutrition (§4.2): раздел 1 (§6.1) использует его,
  // чтобы автокомплит не предлагал "категорийные" ингредиенты (hasNutrition =
  // false, напр. созданные вручную в списке покупок, §6.4) — по ним нельзя
  // посчитать КБЖУ, и в конвейер подбора блюд они всё равно не попадут.
  hasNutrition: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});
