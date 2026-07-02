import { z } from "zod";

export const mealTypeEnum = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

export const dishQuerySchema = z.object({
  mealType: mealTypeEnum.optional(),
  search: z.string().trim().min(1).optional(),
});

export const dishIdParamSchema = z.object({
  id: z.string().min(1),
});
