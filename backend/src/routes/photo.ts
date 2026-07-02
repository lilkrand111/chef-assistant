// POST /api/photo/detect — фото → распознанные продукты + сопоставление с
// базой (§6.1 «Вход A», §8 спецификации). Требует зарегистрированный
// @fastify/multipart (см. server.ts).
import type { FastifyPluginAsync } from "fastify";
import { ApiError } from "../lib/errors";
import { matchIngredient } from "../services/matching";
import { detectProducts } from "../services/ai/vision";
import { AiServiceError } from "../services/ai/errors";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const photoRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/photo/detect", async (request) => {
    const file = await request.file();
    if (!file) {
      throw new ApiError(400, "NO_IMAGE", "Не передано изображение (поле формы 'image')");
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new ApiError(400, "UNSUPPORTED_IMAGE_TYPE", "Поддерживаются только изображения JPEG, PNG, WEBP, GIF");
    }

    const buffer = await file.toBuffer();

    let products;
    try {
      products = await detectProducts(buffer, file.mimetype);
    } catch (err) {
      if (err instanceof AiServiceError) {
        throw new ApiError(
          503,
          "AI_VISION_UNAVAILABLE",
          "Не удалось распознать фото: сервис ИИ временно недоступен. Попробуйте повторить попытку позже."
        );
      }
      throw err;
    }

    // Сопоставление с базой (§7.1) — то же самое, что и для ручного ввода;
    // здесь только показываем пользователю, что нашлось, фильтрация по
    // hasNutrition происходит позже, в POST /api/dishes/from-ingredients.
    const unmatched: string[] = [];
    const result = [];
    for (const product of products) {
      const match = await matchIngredient(product.name);
      result.push({
        name: product.name,
        confidence: product.confidence,
        ingredientId: match?.ingredient.id,
        matched: Boolean(match),
      });
      if (!match) unmatched.push(product.name);
    }

    return { products: result, unmatched };
  });
};

export default photoRoutes;
