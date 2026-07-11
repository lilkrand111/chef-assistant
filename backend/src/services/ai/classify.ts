// Классификация категории ингредиента вне базы (§7.6 спецификации).
// Единственная точка входа, которую вызывают роуты (routes/shopping.ts) —
// они не знают ни про модель, ни про формат запроса/ответа шлюза.
import { IngredientCategory } from "@prisma/client";
import { z } from "zod";
import { getAiClient, getAiModel } from "./client";
import { withAiCache } from "./cache";
import { AiServiceError } from "./errors";
import { extractJson } from "./jsonExtract";

const CATEGORY_VALUES = Object.values(IngredientCategory) as [IngredientCategory, ...IngredientCategory[]];

// Та же схема, что уходит в response_format (§7.6), продублирована как Zod —
// проверяем реальный ответ шлюза, а не полагаемся на strict-режим (шлюз
// сторонний, может его не поддержать или вернуть текст, см. §2, §10).
const categoryResponseSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
});

const CATEGORY_JSON_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: CATEGORY_VALUES },
  },
  required: ["category"],
  additionalProperties: false,
} as const;

async function callClassifyModel(normalizedName: string): Promise<{ category: IngredientCategory }> {
  const client = getAiClient("CLASSIFY");
  const model = getAiModel("CLASSIFY");

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Ты классифицируешь названия продуктов питания по категории для группировки в списке покупок. " +
            "Выбери ровно одну наиболее подходящую категорию из закрытого списка enum. Отвечай только JSON.",
        },
        {
          role: "user",
          content: `Продукт: "${normalizedName}". Верни JSON вида {"category": "<одно из значений enum>"}.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ingredient_category",
          strict: true,
          schema: CATEGORY_JSON_SCHEMA,
        },
      },
    });
  } catch (err) {
    throw new AiServiceError("Не удалось обратиться к ИИ-шлюзу для классификации категории", { cause: err });
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AiServiceError("ИИ вернул пустой ответ при классификации категории");
  }

  const parsedJson = extractJson(content, "классификация категории");
  const validated = categoryResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AiServiceError("ИИ вернул категорию, не входящую в допустимый список");
  }

  // Приводим к простому JSON-объекту без лишних полей — именно это уходит в AiCache.
  return { category: validated.data.category };
}

/**
 * Классифицирует нормализованное имя ингредиента в одну из категорий
 * IngredientCategory (§7.6). Сначала проверяет AiCache (kind = "CATEGORY"),
 * при промахе вызывает AI_MODEL_CLASSIFY и кеширует валидный результат.
 * Бросает AiServiceError, если шлюз недоступен или вернул невалидные данные —
 * вызывающая сторона (routes/shopping.ts) сама решает, как это подать
 * пользователю (§10 «Деградация»).
 */
export async function classifyCategory(normalizedName: string): Promise<IngredientCategory> {
  const { value } = await withAiCache("CATEGORY", normalizedName, () => callClassifyModel(normalizedName));

  // Повторная валидация и для значения из кеша: если формат когда-то
  // изменится (напр. enum пересмотрят), не доверяем слепо старой записи.
  const validated = categoryResponseSchema.safeParse(value);
  if (!validated.success) {
    throw new AiServiceError("Сохранённый в кеше результат классификации повреждён или устарел");
  }

  return validated.data.category;
}
