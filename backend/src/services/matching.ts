// Сопоставление свободной строки с ингредиентом БД (§7.1 спецификации).
// Используется автокомплитом (GET /api/ingredients) и ручным добавлением
// в список покупок (POST /api/shopping/item). Полный алгоритм с семантическим
// матчингом через pgvector — Фаза 5; здесь шаги 1-3 (нормализация → точное
// совпадение → нечёткое через pg_trgm).
import type { Ingredient } from "@prisma/client";
import { prisma } from "../db";

const FUZZY_THRESHOLD = 0.4;

/** Нижний регистр, без скобок-уточнений и пунктуации, схлопнутые пробелы. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[.,;:!?"'%]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type MatchMethod = "exact" | "fuzzy";

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
    SELECT *, similarity("nameNormalized", ${normalized}) AS similarity
    FROM "Ingredient"
    WHERE similarity("nameNormalized", ${normalized}) > ${FUZZY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT 1
  `;
  if (fuzzy.length > 0) {
    const { similarity, ...ingredient } = fuzzy[0];
    return { ingredient: ingredient as Ingredient, method: "fuzzy", score: similarity };
  }

  return null;
}

/** Автокомплит для GET /api/ingredients: несколько кандидатов, отсортированных по релевантности. */
export async function searchIngredients(query: string, limit = 20): Promise<Ingredient[]> {
  const normalized = normalizeName(query);
  if (!normalized) {
    return prisma.ingredient.findMany({ orderBy: { name: "asc" }, take: limit });
  }
  return prisma.$queryRaw<Ingredient[]>`
    SELECT * FROM "Ingredient"
    WHERE "nameNormalized" ILIKE ${"%" + normalized + "%"}
       OR similarity("nameNormalized", ${normalized}) > 0.2
    ORDER BY similarity("nameNormalized", ${normalized}) DESC, "name" ASC
    LIMIT ${limit}
  `;
}
