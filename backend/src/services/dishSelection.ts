// Общий конвейер "блюда по заданным ингредиентам" (§6.1, §7.1-§7.5, §12 Фаза 4):
// сопоставление → поиск в каталоге → при нехватке генерация ИИ → пересчёт КБЖУ
// из базы → сохранение. Используется POST /api/dishes/from-ingredients
// (routes/dishes.ts) для обоих входов раздела 1 — фото и ручной ввод.
import type { Ingredient } from "@prisma/client";
import { prisma } from "../db";
import { dishWithIngredientsInclude, type DishWithIngredients } from "./dishCard";
import { matchIngredient } from "./matching";
import { computeDishNutrition, isKcalSane } from "./nutrition";
import { generateDishes, type GenerationIngredientInput } from "./ai/generate";

export class DishSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DishSelectionError";
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const MIN_CATALOG_CANDIDATES = 3;
const CANDIDATE_DISPLAY_LIMIT = 8;

// Базовые "стейплы", которые можно молчаливо добавить в промпт генерации
// сверх того, что реально нашлось у пользователя (§7.2) — только если они
// вообще есть в базе; отсутствие в seed не считается ошибкой.
const STAPLE_NORMALIZED_NAMES = ["соль", "масло подсолнечное", "масло оливковое", "масло сливочное"];

export interface ResolvedIngredients {
  matchedIds: Set<string>;
  unmatched: string[];
}

/**
 * Сопоставляет вход обоих входов раздела 1 (§8): уже выбранные ingredientId
 * (проверяются на существование и hasNutrition) и свободные names (матчатся
 * через services/matching.ts, §7.1). В matchedIds попадают только базовые
 * ингредиенты с hasNutrition = true — остальное идёт в unmatched, чтобы
 * пользователь мог поправить набор (§6.1 п.3).
 */
export async function resolveIngredientInputs(ingredientIds: string[], names: string[]): Promise<ResolvedIngredients> {
  const matchedIds = new Set<string>();
  const unmatched: string[] = [];

  if (ingredientIds.length > 0) {
    const rows = await prisma.ingredient.findMany({ where: { id: { in: ingredientIds } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of ingredientIds) {
      const ingredient = byId.get(id);
      if (!ingredient) {
        unmatched.push(id);
        continue;
      }
      if (!ingredient.hasNutrition) {
        unmatched.push(ingredient.name);
        continue;
      }
      matchedIds.add(ingredient.id);
    }
  }

  for (const rawName of names) {
    const match = await matchIngredient(rawName);
    if (match && match.ingredient.hasNutrition) {
      matchedIds.add(match.ingredient.id);
    } else {
      unmatched.push(rawName);
    }
  }

  return { matchedIds, unmatched };
}

// Поиск в каталоге (§6.1 п.4, уточнено по итогам тестирования — см. §13):
// блюдо-кандидат, только если ВСЕ его ингредиенты (без исключений для
// специй/масла/соли) входят в совпавшее множество — частичное совпадение
// не допускается, иначе пользователю предлагалось бы блюдо с ингредиентом,
// которого нет на фото/в наборе. Лишние продукты в наборе, которые дишу не
// нужны, кандидатству не мешают. Ранжируем по числу использованных
// ингредиентов (по убыванию) — более полно использующее набор блюдо выше.
async function findCatalogCandidates(matchedIds: Set<string>): Promise<DishWithIngredients[]> {
  const dishes = await prisma.dish.findMany({ include: dishWithIngredientsInclude });

  const candidates = dishes.filter(
    (dish) => dish.ingredients.length > 0 && dish.ingredients.every((di) => matchedIds.has(di.ingredientId))
  );

  candidates.sort((a, b) => b.ingredients.length - a.ingredients.length);
  return candidates;
}

// Идемпотентность (§10): прежде чем сохранять только что сгенерированное
// блюдо, проверяем, нет ли уже AI-блюда с ровно тем же набором ingredientId —
// если есть, переиспользуем его вместо создания дубля в каталоге.
async function findExistingAiDishBySameIngredients(sortedIds: string[]): Promise<DishWithIngredients | null> {
  const aiDishes = await prisma.dish.findMany({ where: { source: "AI" }, include: dishWithIngredientsInclude });
  for (const dish of aiDishes) {
    const ids = [...new Set(dish.ingredients.map((di) => di.ingredientId))].sort();
    if (ids.length === sortedIds.length && ids.every((id, i) => id === sortedIds[i])) {
      return dish;
    }
  }
  return null;
}

export interface DishSelectionResult {
  dishes: DishWithIngredients[];
  generated: boolean;
}

/**
 * Общий конвейер §6.1 п.4-7: сначала каталог, при нехватке — генерация ИИ,
 * пересчёт КБЖУ из базы (никогда не от модели) и сохранение. matchedIds
 * должен быть непустым (проверка на пустоту — обязанность вызывающего роута,
 * там же есть unmatched для ответа пользователю).
 */
export async function selectDishesForIngredients(matchedIds: Set<string>): Promise<DishSelectionResult> {
  const catalogCandidates = await findCatalogCandidates(matchedIds);
  if (catalogCandidates.length >= MIN_CATALOG_CANDIDATES) {
    return { dishes: catalogCandidates.slice(0, CANDIDATE_DISPLAY_LIMIT), generated: false };
  }

  const matchedIngredients = await prisma.ingredient.findMany({
    where: { id: { in: [...matchedIds] }, hasNutrition: true },
  });

  const staples = await prisma.ingredient.findMany({
    where: {
      nameNormalized: { in: STAPLE_NORMALIZED_NAMES },
      hasNutrition: true,
      id: { notIn: matchedIngredients.map((i) => i.id) },
    },
  });

  const generationIngredients: Ingredient[] = [...matchedIngredients, ...staples];
  const generationInput: GenerationIngredientInput[] = generationIngredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    kcal100: ing.kcal100!,
    protein100: ing.protein100!,
    fat100: ing.fat100!,
    carb100: ing.carb100!,
    unit: ing.defaultUnit,
  }));

  let drafts;
  try {
    drafts = await generateDishes(generationInput);
  } catch (err) {
    // ИИ недоступен/не смог составить блюдо: если каталог хоть что-то нашёл
    // (пусть и меньше порога в 3) — отдаём это, а не роняем весь запрос.
    if (catalogCandidates.length > 0) return { dishes: catalogCandidates, generated: false };
    throw err;
  }

  const ingredientById = new Map(generationIngredients.map((i) => [i.id, i]));
  const savedDishes: DishWithIngredients[] = [];

  for (const draft of drafts) {
    // Модель может указать unit некорректно/не по единице ингредиента — КБЖУ
    // никогда не берём от модели (§7.4), поэтому unit тоже переопределяем
    // единицей из базы (defaultUnit), доверяя модели только числу amount.
    const items = draft.ingredients.map((di) => ({
      ingredient: ingredientById.get(di.ingredientId)!,
      amount: di.amount,
      unit: ingredientById.get(di.ingredientId)!.defaultUnit,
    }));

    let totals;
    try {
      totals = computeDishNutrition(items);
    } catch {
      continue; // ошибка данных (напр. pieceMassG) — пропускаем это блюдо, не роняем запрос
    }
    if (!isKcalSane(totals)) continue;

    const sortedIds = [...new Set(draft.ingredients.map((di) => di.ingredientId))].sort();
    const existing = await findExistingAiDishBySameIngredients(sortedIds);
    if (existing) {
      savedDishes.push(existing);
      continue;
    }

    const created = await prisma.dish.create({
      data: {
        name: draft.name,
        description: draft.description,
        mealType: draft.mealType,
        cookTimeMin: draft.cookTimeMin,
        servings: draft.servings,
        isFrac: true,
        difficulty: draft.difficulty,
        kcal: round1(totals.kcal),
        protein: round1(totals.protein),
        fat: round1(totals.fat),
        carb: round1(totals.carb),
        steps: draft.steps,
        source: "AI",
        ingredients: {
          create: draft.ingredients.map((di) => ({
            ingredientId: di.ingredientId,
            amount: di.amount,
            unit: ingredientById.get(di.ingredientId)!.defaultUnit,
            note: di.note ?? null,
          })),
        },
      },
      include: dishWithIngredientsInclude,
    });
    savedDishes.push(created);
  }

  if (savedDishes.length === 0) {
    if (catalogCandidates.length > 0) return { dishes: catalogCandidates, generated: false };
    throw new DishSelectionError(
      "Не удалось составить ни одного блюда с корректным КБЖУ из переданных продуктов. Попробуйте другой набор продуктов."
    );
  }

  const combined = [...catalogCandidates, ...savedDishes];
  const deduped = Array.from(new Map(combined.map((d) => [d.id, d])).values());
  return { dishes: deduped, generated: true };
}
