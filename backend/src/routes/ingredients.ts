// GET /api/ingredients — автокомплит ингредиентов (§8 спецификации).
import type { FastifyPluginAsync } from "fastify";
import { ingredientQuerySchema } from "../schemas/ingredients";
import { searchIngredients } from "../services/matching";

const ingredientsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/ingredients", async (request) => {
    const query = ingredientQuerySchema.parse(request.query);
    return searchIngredients(query.search ?? "", { hasNutrition: query.hasNutrition });
  });
};

export default ingredientsRoutes;
