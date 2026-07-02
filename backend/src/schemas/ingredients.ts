import { z } from "zod";

export const ingredientQuerySchema = z.object({
  search: z.string().trim().optional(),
});
