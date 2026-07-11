// Вижн: фото → структурированный список продуктов (§7.7 спецификации).
// Единственная точка входа, которую вызывает routes/photo.ts.
import crypto from "node:crypto";
import { z } from "zod";
import { getAiClient, getAiModel } from "./client";
import { withAiCache } from "./cache";
import { AiServiceError } from "./errors";
import { extractJson } from "./jsonExtract";

const productSchema = z.object({
  name: z.string(),
  confidence: z.number(),
});

// Та же схема, что уходит в response_format (§7.7), продублирована как Zod —
// шлюз сторонний, может вернуть текст/markdown вместо чистого JSON (§2, §10).
const visionResponseSchema = z.object({ products: z.array(productSchema) });

const VISION_JSON_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["name", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["products"],
  additionalProperties: false,
} as const;

// type, а не interface: именованный interface не проходит структурную
// проверку против рекурсивного Prisma.InputJsonValue (нужен для withAiCache).
export type DetectedProduct = z.infer<typeof productSchema>;

async function callVisionModel(dataUris: string[]): Promise<{ products: DetectedProduct[] }> {
  const client = getAiClient("VISION");
  const model = getAiModel("VISION");

  const photoWord = dataUris.length > 1 ? "этих фото" : "этом фото";

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Ты распознаёшь продукты питания на фото для кулинарного приложения. " +
            "Тебе может быть передано несколько фото за один раз — считай их одним набором " +
            "продуктов и не повторяй один и тот же продукт дважды, даже если он виден на " +
            "нескольких фото. Перечисли все продукты, которые уверенно видишь, обычными " +
            "русскими названиями (как в рецепте, без брендов и лишних уточнений в скобках). " +
            "confidence — число от 0 до 1, насколько ты уверен в распознавании конкретного " +
            "продукта. Отвечай только JSON.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Какие продукты питания есть на ${photoWord}? Верни JSON по схеме.` },
            ...dataUris.map((dataUri) => ({ type: "image_url" as const, image_url: { url: dataUri } })),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "detected_products",
          strict: true,
          schema: VISION_JSON_SCHEMA,
        },
      },
    });
  } catch (err) {
    throw new AiServiceError("Не удалось обратиться к ИИ-шлюзу для распознавания фото", { cause: err });
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AiServiceError("ИИ вернул пустой ответ при распознавании фото");
  }

  const parsedJson = extractJson(content, "распознавание фото");
  const validated = visionResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AiServiceError("ИИ вернул список продуктов в неверном формате");
  }
  return validated.data;
}

export interface DetectImageInput {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Распознаёт продукты на 1-4 фото за один вызов ИИ (§7.7) — несколько фото
 * идут в одном сообщении, а не отдельными запросами, чтобы не тратить лишние
 * запросы к дневному лимиту (§10). Кеш — по отсортированным sha256 БАЙТОВ
 * каждого фото (порядок загрузки не важен), а не по содержимому ответа,
 * чтобы тот же набор фото не вызывал ИИ повторно даже до получения ответа.
 * Бросает AiServiceError при недоступном шлюзе или невалидном ответе —
 * routes/photo.ts превращает её в понятную клиентскую ошибку (§10 «Деградация»).
 */
export async function detectProducts(images: DetectImageInput[]): Promise<DetectedProduct[]> {
  const bytesHash = images
    .map(({ buffer }) => crypto.createHash("sha256").update(buffer).digest("hex"))
    .sort()
    .join(",");
  const dataUris = images.map(
    ({ buffer, mimeType }) => `data:${mimeType};base64,${buffer.toString("base64")}`
  );

  const { value } = await withAiCache("VISION", bytesHash, () => callVisionModel(dataUris));

  // Повторная валидация и для значения из кеша (см. classify.ts) — формат
  // мог измениться, а из AiCache приходит непроверенный JSON.
  const validated = visionResponseSchema.safeParse(value);
  if (!validated.success) {
    throw new AiServiceError("Сохранённый в кеше результат распознавания фото повреждён или устарел");
  }
  return validated.data.products;
}
