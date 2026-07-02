// GET/POST /api/saved, DELETE /api/saved/:dishId (§6.3, §8 спецификации).
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db";
import { ApiError } from "../lib/errors";
import { dishIdParamSchema, saveDishBodySchema } from "../schemas/saved";
import { dishWithIngredientsInclude, toDishCard } from "../services/dishCard";

const savedRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/saved", async (request) => {
    const saved = await prisma.savedRecipe.findMany({
      where: { userId: request.userId },
      include: { dish: { include: dishWithIngredientsInclude } },
      orderBy: { savedAt: "desc" },
    });
    return saved.map((s) => toDishCard(s.dish));
  });

  app.post("/api/saved", async (request, reply) => {
    const { dishId } = saveDishBodySchema.parse(request.body);

    const dish = await prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) {
      throw new ApiError(404, "DISH_NOT_FOUND", "Блюдо не найдено");
    }

    // Идемпотентность (§6.3): повторное сохранение не плодит дубль —
    // используем @@unique([userId, dishId]) через upsert.
    await prisma.savedRecipe.upsert({
      where: { userId_dishId: { userId: request.userId, dishId } },
      create: { userId: request.userId, dishId },
      update: {},
    });

    reply.status(201);
    return { ok: true };
  });

  app.delete("/api/saved/:dishId", async (request) => {
    const { dishId } = dishIdParamSchema.parse(request.params);
    await prisma.savedRecipe.deleteMany({ where: { userId: request.userId, dishId } });
    return { ok: true };
  });
};

export default savedRoutes;
