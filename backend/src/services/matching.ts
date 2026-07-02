// Сопоставление свободной строки с ингредиентом БД (§7.1 спецификации).
// Используется автокомплитом (GET /api/ingredients) и ручным добавлением
// в список покупок (POST /api/shopping/item). Четыре шага: нормализация →
// точное совпадение → нечёткое через pg_trgm → семантическое через pgvector
// (Фаза 5, только если 2-3 ничего не дали).
import { Prisma, type Ingredient } from "@prisma/client";
import { prisma } from "../db";
import { embed, toVectorLiteral } from "./ai/embed";

const FUZZY_THRESHOLD = 0.4;
const SEMANTIC_THRESHOLD = Number(process.env.AI_EMBED_MATCH_THRESHOLD ?? 0.85);

// Явный список колонок вместо "SELECT *": Ingredient.embedding — Unsupported("vector"),
// Prisma Client не умеет десериализовать его из $queryRaw (падает с
// "Failed to deserialize column of type 'vector'") даже когда он просто попал
// в выборку мимо, а не используется. Используется во всех трёх raw-запросах ниже.
const INGREDIENT_COLUMNS = Prisma.sql`"id", "name", "nameNormalized", "aliases", "category", "kcal100", "protein100", "fat100", "carb100", "pieceMassG", "defaultUnit", "hasNutrition", "source", "createdAt"`;

/** Нижний регистр, без скобок-уточнений и пунктуации, схлопнутые пробелы. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[.,;:!?"'%]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Все цифры строки подряд, без разделителей — для сверки числового "смысла" двух названий. */
function digitsOf(s: string): string {
  return (s.match(/\d/g) ?? []).join("");
}

export type MatchMethod = "exact" | "fuzzy" | "semantic";

export interface MatchResult {
  ingredient: Ingredient;
  method: MatchMethod;
  score?: number;
}

/** Шаги 1-3 §7.1: нормализация → точное совпадение (nameNormalized/aliases) → нечёткое (pg_trgm). */
export async function matchIngredient(rawName: string): Promise<MatchResult | null> {
  const normalized = normalizeName(rawName);
  if (!normalized) return null;

  const exact = await prisma.ingredient.findFirst({
    where: {
      OR: [{ nameNormalized: normalized }, { aliases: { has: normalized } }],
    },
  });
  if (exact) return { ingredient: exact, method: "exact" };

  const fuzzy = await prisma.$queryRaw<Array<Ingredient & { similarity: number }>>`
    SELECT ${INGREDIENT_COLUMNS}, similarity("nameNormalized", ${normalized}) AS similarity
    FROM "Ingredient"
    WHERE similarity("nameNormalized", ${normalized}) > ${FUZZY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT 1
  `;
  if (fuzzy.length > 0) {
    const { similarity, ...ingredient } = fuzzy[0];
    // pg_trgm не различает "опечатка/словоформа" от "другое слово": у
    // "мёд"/"мёда" сходство 0.5 — ровно как у "мёд"/"мёд1", порогом это не
    // развести (проверено на реальных названиях из seed). Цифры в русских
    // названиях продуктов различают конкретный товар (напр. "Молоко 3.2%"),
    // а не бывают опечаткой — поэтому расхождение по набору цифр считаем
    // явным признаком другого товара, даже если сходство строк выше порога.
    if (digitsOf(normalized) === digitsOf(ingredient.nameNormalized)) {
      return { ingredient: ingredient as Ingredient, method: "fuzzy", score: similarity };
    }
  }

  return matchSemantic(normalized);
}

/**
 * Шаг 4 §7.1 (Фаза 5): семантический fallback через pgvector, только когда
 * exact и trgm (шаги 2-3) ничего не дали — напр. "зелёное яблоко" → "Яблоко",
 * где нет ни точного совпадения, ни близкой строки по триграммам.
 *
 * КРИТИЧНО: применяем ТУ ЖЕ защиту от цифровых дублей (digitsOf), что и в
 * нечётком шаге. Косинусное сходство эмбеддингов "молоко 3.2%"/"молоко 2.5%"
 * (~0.94, проверено на реальной модели) ВЫШЕ, чем у целевого кейса "яблоко"/
 * "зелёное яблоко" (~0.88) — порог сходства сам по себе эту пару не разделит,
 * только явная сверка цифр в названии не даёт эмбеддингам "слить" разные
 * товары в одну позицию.
 */
async function matchSemantic(normalized: string): Promise<MatchResult | null> {
  let queryVector: number[];
  try {
    queryVector = await embed(normalized);
  } catch {
    // Деградация (§10): модель эмбеддингов не загрузилась/недоступна — просто
    // нет семантического совпадения, а не ошибка всего запроса. exact/trgm
    // (шаги 1-3) от локальной модели не зависят и продолжают работать.
    return null;
  }
  const vectorLiteral = toVectorLiteral(queryVector);

  const rows = await prisma.$queryRaw<Array<Ingredient & { distance: number }>>`
    SELECT ${INGREDIENT_COLUMNS}, (embedding <=> ${vectorLiteral}::vector) AS distance
    FROM "Ingredient"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT 1
  `;
  if (rows.length === 0) return null;

  const { distance, ...ingredient } = rows[0];
  const similarity = 1 - distance;
  if (similarity < SEMANTIC_THRESHOLD) return null;

  if (digitsOf(normalized) !== digitsOf(ingredient.nameNormalized)) return null;

  return { ingredient: ingredient as Ingredient, method: "semantic", score: similarity };
}

export interface SearchIngredientsOptions {
  limit?: number;
  // Раздел 1 (§6.1) передаёт true, чтобы автокомплит набора продуктов не
  // предлагал "категорийные" ингредиенты (hasNutrition = false) — по ним
  // нельзя посчитать КБЖУ, поэтому их не должно быть даже в подсказках, а не
  // только молча в unmatched после отправки. Без опции (undefined) — без
  // фильтра, как раньше (используется списком покупок, §6.4, где категорийные
  // ингредиенты — штатный случай).
  hasNutrition?: boolean;
}

/** Автокомплит для GET /api/ingredients: несколько кандидатов, отсортированных по релевантности. */
export async function searchIngredients(query: string, options: SearchIngredientsOptions = {}): Promise<Ingredient[]> {
  const limit = options.limit ?? 20;
  const normalized = normalizeName(query);
  const nutritionFilter =
    options.hasNutrition === undefined ? Prisma.empty : Prisma.sql`AND "hasNutrition" = ${options.hasNutrition}`;

  if (!normalized) {
    return prisma.ingredient.findMany({
      where: options.hasNutrition === undefined ? undefined : { hasNutrition: options.hasNutrition },
      orderBy: { name: "asc" },
      take: limit,
    });
  }
  return prisma.$queryRaw<Ingredient[]>`
    SELECT ${INGREDIENT_COLUMNS} FROM "Ingredient"
    WHERE ("nameNormalized" ILIKE ${"%" + normalized + "%"} OR similarity("nameNormalized", ${normalized}) > 0.2)
    ${nutritionFilter}
    ORDER BY similarity("nameNormalized", ${normalized}) DESC, "name" ASC
    LIMIT ${limit}
  `;
}
