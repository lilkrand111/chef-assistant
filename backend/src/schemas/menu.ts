import { z } from "zod";
import { mealTypeEnum } from "./dishes";

export const goalEnum = z.enum(["DIET", "MAINTENANCE", "MASS"]);

export const menuGenerateSchema = z.object({
  targetKcal: z.number().positive(),
  protein: z.number().nonnegative().optional(),
  fat: z.number().nonnegative().optional(),
  carb: z.number().nonnegative().optional(),
  goal: goalEnum,
});

export type MenuGenerateBody = z.infer<typeof menuGenerateSchema>;

const menuCurrentMealSchema = z.object({
  mealType: mealTypeEnum,
  dishId: z.string(),
  portionScale: z.number().positive(),
});

// Замена одного блюда в уже собранном плане (кнопка "Заменить", §6.2): вместе
// с целью присылается текущий план (meals), чтобы остальные приёмы пищи можно
// было зафиксировать и пересчитать только масштаб порций при доборе (§7.3).
export const menuReplaceMealSchema = z.object({
  targetKcal: z.number().positive(),
  protein: z.number().nonnegative().optional(),
  fat: z.number().nonnegative().optional(),
  carb: z.number().nonnegative().optional(),
  goal: goalEnum,
  meals: z.array(menuCurrentMealSchema).min(1),
  mealType: mealTypeEnum,
});

export type MenuReplaceMealBody = z.infer<typeof menuReplaceMealSchema>;
