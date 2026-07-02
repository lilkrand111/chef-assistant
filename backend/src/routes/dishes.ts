// GET /api/dishes, GET /api/dishes/:id (§8 спецификации).
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db";
import { ApiError } from "../lib/errors";
import { dishIdParamSchema, dishQuerySchema } from "../schemas/dishes";
import { dishWithIngredientsInclude, toDishCard } from "../services/dishCard";

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
};

export default dishesRoutes;
