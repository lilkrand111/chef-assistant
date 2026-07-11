// POST /api/photo/detect — фото → распознанные продукты + сопоставление с
// базой (§6.1 «Вход A», §8 спецификации). Требует зарегистрированный
// @fastify/multipart (см. server.ts).
import type { FastifyPluginAsync } from "fastify";
import sharp from "sharp";
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
      const rawBuffer = await part.toBuffer();
      // Перекодируем всё в JPEG перед отправкой в ИИ (§10) — меньше байт по
      // сети/в запросе к Gemini, чем оригинальные PNG/WEBP/GIF. .rotate() без
      // аргументов — выравнивание по EXIF-тегу ориентации перед перекодировкой,
      // иначе после перекодировки метаданные теряются и фото с телефона может
      // оказаться повёрнутым. resize до 1280px по длинной стороне — тот же
      // порядок, что даёт Telegram при отправке "как фото" (не "как файл"):
      // основной вклад в снижение веса даёт именно уменьшение разрешения, а
      // не только качество JPEG (12-48 Мп для распознавания продуктов не
      // нужны). mozjpeg — более эффективное кодирование при том же визуальном
      // качестве. withoutEnlargement — не увеличивать маленькие фото.
      let buffer: Buffer;
      try {
        buffer = await sharp(rawBuffer)
          .rotate()
          .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();
      } catch {
        throw new ApiError(
          400,
          "INVALID_IMAGE",
          "Не удалось обработать изображение — файл повреждён или в неподдерживаемом формате"
        );
      }
      files.push({ buffer, mimetype: "image/jpeg" });
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
