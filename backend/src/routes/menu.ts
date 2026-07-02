// POST /api/menu/generate, POST /api/menu/replace-meal (§6.2, §7.3, §8 спецификации).
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db";
import { ApiError } from "../lib/errors";
import { menuGenerateSchema, menuReplaceMealSchema } from "../schemas/menu";
import { dishWithIngredientsInclude, toDishCard } from "../services/dishCard";
import { generateMenu, MenuUnreachableError, replaceMenuMeal } from "../services/menu";
import type { MenuPlan } from "../services/menu";

function serializePlan(plan: MenuPlan) {
  return {
    meals: plan.meals.map((meal) => ({
      mealType: meal.mealType,
      dish: toDishCard(meal.dish),
      portionScale: meal.portionScale,
    })),
    totals: plan.totals,
    deviation: plan.deviation,
  };
}

const menuRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/menu/generate", async (request) => {
    const input = menuGenerateSchema.parse(request.body);

    const catalog = await prisma.dish.findMany({ include: dishWithIngredientsInclude });

    try {
      const plan = generateMenu(input, catalog);
      return serializePlan(plan);
    } catch (err) {
      if (err instanceof MenuUnreachableError) {
        throw new ApiError(422, "MENU_TARGET_UNREACHABLE", err.message);
      }
      throw err;
    }
  });

  // Кнопка "Заменить" у блюда на экране меню (§6.2): подбирает другое блюдо
  // того же приёма пищи так, чтобы план в целом остался в пределах ±5% от цели.
  app.post("/api/menu/replace-meal", async (request) => {
    const input = menuReplaceMealSchema.parse(request.body);

    const catalog = await prisma.dish.findMany({ include: dishWithIngredientsInclude });

    try {
      const plan = replaceMenuMeal(input, catalog, input.meals, input.mealType);
      return serializePlan(plan);
    } catch (err) {
      if (err instanceof MenuUnreachableError) {
        throw new ApiError(422, "MENU_TARGET_UNREACHABLE", err.message);
      }
      throw err;
    }
  });
};

export default menuRoutes;
