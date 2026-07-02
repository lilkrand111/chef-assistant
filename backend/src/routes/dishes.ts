// GET /api/dishes, GET /api/dishes/:id, POST /api/dishes/from-ingredients (§8 спецификации).
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db";
import { ApiError } from "../lib/errors";
import { dishIdParamSchema, dishQuerySchema, fromIngredientsBodySchema } from "../schemas/dishes";
import { dishWithIngredientsInclude, toDishCard } from "../services/dishCard";
import { AiServiceError } from "../services/ai/errors";
import { DishSelectionError, resolveIngredientInputs, selectDishesForIngredients } from "../services/dishSelection";

const dishesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/dishes", async (request) => {
    const query = dishQuerySchema.parse(request.query);

    const dishes = await prisma.dish.findMany({
      where: {
        ...(query.mealType ? { mealType: query.mealType } : {}),
        ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
      },
      include: dishWithIngredientsInclude,
      orderBy: { name: "asc" },
    });

    return dishes.map(toDishCard);
  });

  app.get("/api/dishes/:id", async (request) => {
    const { id } = dishIdParamSchema.parse(request.params);

    const dish = await prisma.dish.findUnique({
      where: { id },
      include: dishWithIngredientsInclude,
    });
    if (!dish) {
      throw new ApiError(404, "DISH_NOT_FOUND", "Блюдо не найдено");
    }

    return toDishCard(dish);
  });

  // Общий конвейер раздела 1 (§6.1, §8): один движок для входа с фото
  // (POST /api/photo/detect отдаёт products, фронт подтверждает набор и шлёт
  // сюда) и для ручного ввода без фото (сразу names).
  app.post("/api/dishes/from-ingredients", async (request) => {
    const body = fromIngredientsBodySchema.parse(request.body);
    const { matchedIds, unmatched } = await resolveIngredientInputs(body.ingredientIds ?? [], body.names ?? []);

    if (matchedIds.size === 0) {
      throw new ApiError(
        400,
        "NO_MATCHED_INGREDIENTS",
        "Ни один продукт не удалось сопоставить с базой ингредиентов, по которым можно посчитать КБЖУ"
      );
    }

    try {
      const { dishes, generated } = await selectDishesForIngredients(matchedIds);
      return { dishes: dishes.map(toDishCard), generated, unmatched };
    } catch (err) {
      if (err instanceof AiServiceError) {
        throw new ApiError(
          503,
          "AI_GENERATION_UNAVAILABLE",
          "Не удалось подобрать блюда: сервис ИИ временно недоступен. Попробуйте повторить попытку позже."
        );
      }
      if (err instanceof DishSelectionError) {
        throw new ApiError(422, "DISH_SELECTION_FAILED", err.message);
      }
      throw err;
    }
  });
};

export default dishesRoutes;
