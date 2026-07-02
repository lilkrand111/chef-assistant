import { z } from "zod";

export const mealTypeEnum = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

export const dishQuerySchema = z.object({
  mealType: mealTypeEnum.optional(),
  search: z.string().trim().min(1).optional(),
});

export const dishIdParamSchema = z.object({
  id: z.string().min(1),
});

// Тело POST /api/dishes/from-ingredients (§8, §6.1): ingredientIds — уже
// сопоставленные ингредиенты (напр. подтверждённые продукты с фото или выбор
// из автокомплита), names — свободный ручной ввод, сервер сам матчит их (§7.1).
export const fromIngredientsBodySchema = z
  .object({
    ingredientIds: z.array(z.string().min(1)).optional(),
    names: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((data) => (data.ingredientIds?.length ?? 0) > 0 || (data.names?.length ?? 0) > 0, {
    message: "Нужно указать ingredientIds или names",
  });
