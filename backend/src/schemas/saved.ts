import { z } from "zod";

export const saveDishBodySchema = z.object({
  dishId: z.string().min(1),
});

export const dishIdParamSchema = z.object({
  dishId: z.string().min(1),
});
