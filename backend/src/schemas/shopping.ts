import { z } from "zod";

export const addShoppingItemSchema = z
  .object({
    ingredientId: z.string().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    amount: z.number().positive().optional(),
    unit: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.ingredientId) || Boolean(data.name), {
    message: "Нужно указать ingredientId или name",
  });

export const fromDishBodySchema = z.object({
  ingredientIds: z.array(z.string().min(1)).optional(),
  // Коэффициент масштабирования порции (§7.3): позволяет добавить в список
  // покупок количество, пересчитанное под план меню, а не базовый рецепт.
  scale: z.number().positive().optional(),
});

export const patchShoppingItemSchema = z.object({
  checked: z.boolean().optional(),
  amount: z.number().positive().nullable().optional(),
  unit: z.string().trim().min(1).optional(),
});

export const shoppingIdParamSchema = z.object({
  id: z.string().min(1),
});

export const dishIdParamSchema = z.object({
  dishId: z.string().min(1),
});
