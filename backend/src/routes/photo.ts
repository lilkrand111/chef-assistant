// POST /api/photo/detect — фото → распознанные продукты + сопоставление с
// базой (§6.1 «Вход A», §8 спецификации). Требует зарегистрированный
// @fastify/multipart (см. server.ts).
import type { FastifyPluginAsync } from "fastify";
import { ApiError } from "../lib/errors";
import { matchIngredient } from "../services/matching";
import { detectProducts } from "../services/ai/vision";
import { AiServiceError } from "../services/ai/errors";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Один вызов ИИ обрабатывает все фото сразу (см. services/ai/vision.ts) —
// граница здесь защищает дневной лимит запросов к ИИ (§10), а не размер
// одного сообщения. @fastify/multipart (server.ts) дублирует этот же
// потолок на уровне парсера.
const MAX_PHOTOS = 4;

const photoRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/photo/detect", async (request) => {
    const files: { buffer: Buffer; mimetype: string }[] = [];
    for await (const part of request.files()) {
      if (files.length >= MAX_PHOTOS) {
        throw new ApiError(400, "TOO_MANY_IMAGES", `Максимум ${MAX_PHOTOS} фото за один раз`);
      }
      if (!ALLOWED_MIME_TYPES.has(part.mimetype)) {
        throw new ApiError(400, "UNSUPPORTED_IMAGE_TYPE", "Поддерживаются только изображения JPEG, PNG, WEBP, GIF");
      }
      files.push({ buffer: await part.toBuffer(), mimetype: part.mimetype });
    }
    if (files.length === 0) {
      throw new ApiError(400, "NO_IMAGE", "Не передано изображение (поле формы 'image')");
    }

    let products;
    try {
      products = await detectProducts(files.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype })));
    } catch (err) {
      if (err instanceof AiServiceError) {
        request.log.error({ err, cause: err.cause }, "AI vision request failed");
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
