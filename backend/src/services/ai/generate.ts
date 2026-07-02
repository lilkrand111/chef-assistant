// Генерация блюд из заданных ингредиентов (§7.2 спецификации). Вызывается,
// только когда в каталоге не хватило кандидатов — см. services/dishSelection.ts.
// КБЖУ этот модуль НЕ считает и не возвращает: он отдаёт только состав
// (ingredientId + amount), пересчёт из базы — задача services/nutrition.ts (§7.5).
import { Difficulty, MealType } from "@prisma/client";
import { z } from "zod";
import { getAiClient, getAiModel } from "./client";
import { withAiCache } from "./cache";
import { AiServiceError } from "./errors";
import { extractJson } from "./jsonExtract";

const MEAL_TYPE_VALUES = Object.values(MealType) as [MealType, ...MealType[]];
const DIFFICULTY_VALUES = Object.values(Difficulty) as [Difficulty, ...Difficulty[]];

const generatedIngredientSchema = z.object({
  ingredientId: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1),
  // nullable, а не optional: строгий json_schema-режим (§2) требует, чтобы
  // ВСЕ свойства были в "required" — опциональность моделируется через null,
  // а не через отсутствие ключа (иначе шлюз отклоняет саму схему).
  note: z.string().nullable(),
});

const generatedDishSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  mealType: z.enum(MEAL_TYPE_VALUES),
  cookTimeMin: z.number().int().positive(),
  servings: z.number().int().positive(),
  difficulty: z.enum(DIFFICULTY_VALUES),
  // min(12)/min(2): мягкий эвристический барьер против вырожденных шагов
  // ("Смешать.") — не проверка смысла, реальную детализацию обеспечивает
  // промпт ниже. Тот же порог качества, что и у seed-каталога (§5, §13
  // «Фаза 5», редактирование рецептов) — не хардкодить в JSON_SCHEMA ниже,
  // strict-режим стороннего шлюза может не поддержать minLength (§2, §10).
  steps: z.array(z.string().min(12)).min(2),
  ingredients: z.array(generatedIngredientSchema).min(1),
});

// Та же схема, что уходит в response_format (§7.2), продублирована как Zod —
// не доверяем strict-режиму стороннего шлюза (§2, §10).
const generationResponseSchema = z.object({ dishes: z.array(generatedDishSchema).min(1) });

export type GeneratedDish = z.infer<typeof generatedDishSchema>;

const GENERATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    dishes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          mealType: { type: "string", enum: MEAL_TYPE_VALUES },
          cookTimeMin: { type: "integer" },
          servings: { type: "integer" },
          difficulty: { type: "string", enum: DIFFICULTY_VALUES },
          steps: { type: "array", items: { type: "string" } },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ingredientId: { type: "string" },
                amount: { type: "number" },
                unit: { type: "string" },
                note: { type: ["string", "null"] },
              },
              required: ["ingredientId", "amount", "unit", "note"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "description", "mealType", "cookTimeMin", "servings", "difficulty", "steps", "ingredients"],
        additionalProperties: false,
      },
    },
  },
  required: ["dishes"],
  additionalProperties: false,
} as const;

export interface GenerationIngredientInput {
  id: string;
  name: string;
  kcal100: number;
  protein100: number;
  fat100: number;
  carb100: number;
  unit: string;
}

async function callGenerateModel(ingredients: GenerationIngredientInput[]): Promise<{ dishes: GeneratedDish[] }> {
  const client = getAiClient();
  const model = getAiModel("GENERATION");

  const ingredientsForPrompt = ingredients.map((i) => ({
    ingredientId: i.id,
    name: i.name,
    unit: i.unit,
    kcal100: i.kcal100,
    protein100: i.protein100,
    fat100: i.fat100,
    carb100: i.carb100,
  }));

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Ты повар, который придумывает рецепты СТРОГО из заданного списка ингредиентов. " +
            "Скомпонуй от 1 до 3 реалистичных блюд. В каждом блюде используй ТОЛЬКО переданные ingredientId " +
            "(не выдумывай новые ингредиенты и не используй те, которых нет в списке) — можно использовать не все. " +
            "Для каждого ингредиента задавай amount в единице, указанной у него в поле unit. " +
            "КБЖУ не указывай — оно считается отдельно от базы данных. " +
            "Шаги рецепта (steps) должны быть подробными и однозначно выполнимыми: указывай " +
            "конкретное время в минутах, уровень нагрева (сильный/средний/слабый огонь) и посуду " +
            "там, где это уместно, а также понятный признак готовности (например, «до золотистой " +
            "корочки», «до мягкости», «пока не загустеет»). Не объединяй в один шаг несколько " +
            "разных действий. Для блюд, требующих готовки, обычно нужно 4-7 шагов; для очень " +
            "простых блюд без готовки — меньше, но так же конкретно. Не используй общие фразы " +
            "вроде «приготовить» или «довести до готовности» без пояснения, что именно и сколько " +
            "по времени делать.",
        },
        {
          role: "user",
          content: `Доступные ингредиенты (JSON): ${JSON.stringify(ingredientsForPrompt)}. Верни JSON по схеме.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_dishes",
          strict: true,
          schema: GENERATION_JSON_SCHEMA,
        },
      },
    });
  } catch (err) {
    throw new AiServiceError("Не удалось обратиться к ИИ-шлюзу для генерации блюд", { cause: err });
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AiServiceError("ИИ вернул пустой ответ при генерации блюд");
  }

  const parsedJson = extractJson(content, "генерация блюд");
  const validated = generationResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AiServiceError("ИИ вернул блюда в неверном формате");
  }
  return validated.data;
}

/**
 * Генерирует 1-3 блюда строго из переданных ингредиентов (§7.2). Кеш — по
 * отсортированному набору ingredientId (§10). После получения (в т.ч. из
 * кеша) отбрасывает блюда, использующие ingredientId вне переданного набора —
 * невалидное блюдо не "чинится" подстановкой, а просто исключается (§7.4).
 * Бросает AiServiceError, если шлюз недоступен или ни одно блюдо не прошло
 * проверку — вызывающая сторона (services/dishSelection.ts) решает, что
 * делать дальше (§10 «Деградация»).
 */
export async function generateDishes(ingredients: GenerationIngredientInput[]): Promise<GeneratedDish[]> {
  const ids = ingredients.map((i) => i.id);
  const normalizedInput = [...new Set(ids)].sort().join(",");

  const { value } = await withAiCache("GENERATION", normalizedInput, () => callGenerateModel(ingredients));

  const validated = generationResponseSchema.safeParse(value);
  if (!validated.success) {
    throw new AiServiceError("Сохранённый в кеше результат генерации блюд повреждён или устарел");
  }

  const validIds = new Set(ids);
  const validDishes = validated.data.dishes.filter((dish) =>
    dish.ingredients.every((ing) => validIds.has(ing.ingredientId))
  );

  if (validDishes.length === 0) {
    throw new AiServiceError("ИИ не смог составить блюдо только из переданных ингредиентов");
  }

  return validDishes.slice(0, 3);
}
