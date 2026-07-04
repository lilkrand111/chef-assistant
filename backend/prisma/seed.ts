import { Ingredient } from "@prisma/client";
import { prisma } from "../src/db";
import { computeDishNutrition, isKcalSane } from "../src/services/nutrition";
import { normalizeName } from "../src/services/matching";
import { embedBatch, toVectorLiteral } from "../src/services/ai/embed";
import { INGREDIENTS } from "./data/ingredients";
import { DISHES } from "./data/dishes";

const round1 = (n: number) => Math.round(n * 10) / 10;

async function seedIngredients(): Promise<Map<string, Ingredient>> {
  const map = new Map<string, Ingredient>();

  for (const item of INGREDIENTS) {
    const nameNormalized = normalizeName(item.name);
    const data = {
      nameNormalized,
      aliases: item.aliases,
      category: item.category,
      kcal100: item.kcal100,
      protein100: item.protein100,
      fat100: item.fat100,
      carb100: item.carb100,
      pieceMassG: item.pieceMassG ?? null,
      defaultUnit: item.defaultUnit,
      hasNutrition: true,
      source: "SEED" as const,
    };

    const ingredient = await prisma.ingredient.upsert({
      where: { name: item.name },
      update: data,
      create: { name: item.name, ...data },
    });

    map.set(item.name, ingredient);
  }

  return map;
}

// Единицы, которые умеет конвертировать nutrition.ts (§7.5): "г"/"мл" 1:1,
// "шт" через pieceMassG. Любая другая единица («ст.л.» и т.п.) молча посчиталась
// бы как граммы и исказила КБЖУ — поэтому это жёсткая ошибка seed, а не warning.
const ALLOWED_UNITS = new Set(["г", "мл", "шт"]);
const MIN_STEPS = 3;
const MAX_STEPS = 8;
const MAX_COOK_MIN = 60;

/**
 * Жёсткий сан-чек каталога ПЕРЕД любой записью (§5, §7.4, §7.5). Собирает все
 * нарушения и валит seed одной понятной ошибкой со списком — одно плохое блюдо
 * не должно молча просочиться в БД. Для каталожных блюд авто-дедупа нет (он есть
 * только на AI-пути), поэтому дедуп по mealType + отсортированному множеству
 * ingredientId (+ нормализованное имя) обеспечиваем здесь.
 */
function validateDishes(ingredientMap: Map<string, Ingredient>): void {
  const problems: string[] = [];
  const bySignature = new Map<string, string[]>();
  const byName = new Map<string, string[]>();

  for (const dish of DISHES) {
    // difficulty: только EASY/MEDIUM (§ «простые в готовке»).
    if (dish.difficulty !== "EASY" && dish.difficulty !== "MEDIUM") {
      problems.push(`"${dish.name}": difficulty ${dish.difficulty} (допустимы только EASY/MEDIUM)`);
    }
    // Подробность и простота: разумное число шагов и время готовки.
    if (dish.steps.length < MIN_STEPS || dish.steps.length > MAX_STEPS) {
      problems.push(`"${dish.name}": ${dish.steps.length} шаг(ов) (норма ${MIN_STEPS}–${MAX_STEPS})`);
    }
    if (dish.cookTimeMin < 1 || dish.cookTimeMin > MAX_COOK_MIN) {
      problems.push(`"${dish.name}": cookTimeMin ${dish.cookTimeMin} (норма 1–${MAX_COOK_MIN})`);
    }

    const ingredientIds: string[] = [];
    for (const di of dish.ingredients) {
      const ingredient = ingredientMap.get(di.name);
      if (!ingredient) {
        problems.push(`"${dish.name}": ингредиент "${di.name}" не найден в каталоге ингредиентов`);
        continue;
      }
      ingredientIds.push(ingredient.id);
      if (!ALLOWED_UNITS.has(di.unit)) {
        problems.push(`"${dish.name}": ингредиент "${di.name}" в единице "${di.unit}" (допустимы только г/мл/шт)`);
      }
      if ((di.unit === "шт" || di.unit === "шт.") && ingredient.pieceMassG == null) {
        problems.push(`"${dish.name}": счётный ингредиент "${di.name}" (шт) без pieceMassG`);
      }
    }

    // Дедуп: (mealType + отсортированный набор ingredientId) и (mealType + имя).
    const sig = `${dish.mealType}|${[...ingredientIds].sort().join(",")}`;
    (bySignature.get(sig) ?? bySignature.set(sig, []).get(sig)!).push(dish.name);
    const nameKey = `${dish.mealType}|${normalizeName(dish.name)}`;
    (byName.get(nameKey) ?? byName.set(nameKey, []).get(nameKey)!).push(dish.name);
  }

  for (const [sig, names] of bySignature) {
    if (names.length > 1) problems.push(`Дубль состава (${sig.split("|")[0]}): ${names.join(" == ")}`);
  }
  for (const [, names] of byName) {
    if (names.length > 1) problems.push(`Дубль имени в одном mealType: ${names.join(" == ")}`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Seed остановлен: каталог не прошёл валидацию (${problems.length} проблем(ы)).\n` +
        problems.map((m) => `  - ${m}`).join("\n")
    );
  }
}

async function seedDishes(ingredientMap: Map<string, Ingredient>): Promise<void> {
  // Валидация ДО деструктивных операций: если данные плохие, существующий
  // каталог в БД не трогаем (deleteMany ниже не выполнится).
  validateDishes(ingredientMap);

  // Идемпотентность: каталожные блюда пересоздаются с нуля при каждом запуске.
  // DishIngredient удаляется каскадно (onDelete: Cascade в schema.prisma).
  await prisma.dish.deleteMany({ where: { source: "CATALOG" } });

  // Барьер §7.5: isKcalSane — жёсткая ошибка, а не warning. validateDishes уже
  // проверил структуру; здесь считаем КБЖУ из состава и собираем несуразности.
  const insaneDishes: string[] = [];

  for (const dish of DISHES) {
    const resolved = dish.ingredients.map((di) => {
      const ingredient = ingredientMap.get(di.name);
      if (!ingredient) {
        throw new Error(
          `Ошибка данных seed: ингредиент "${di.name}" для блюда "${dish.name}" не найден в каталоге ингредиентов`
        );
      }
      return { ingredient, amount: di.amount, unit: di.unit, note: di.note };
    });

    // computeDishNutrition бросит понятную ошибку, если у "шт"-ингредиента не заполнен pieceMassG.
    const totals = computeDishNutrition(
      resolved.map(({ ingredient, amount, unit }) => ({
        ingredient: {
          name: ingredient.name,
          hasNutrition: ingredient.hasNutrition,
          kcal100: ingredient.kcal100,
          protein100: ingredient.protein100,
          fat100: ingredient.fat100,
          carb100: ingredient.carb100,
          pieceMassG: ingredient.pieceMassG,
        },
        amount,
        unit,
      }))
    );

    if (!isKcalSane(totals)) {
      insaneDishes.push(`"${dish.name}": ккал (${totals.kcal.toFixed(0)}) заметно расходится с 4Б+9Ж+4У`);
    }

    await prisma.dish.create({
      data: {
        name: dish.name,
        description: dish.description,
        mealType: dish.mealType,
        cookTimeMin: dish.cookTimeMin,
        servings: dish.servings,
        isFrac: dish.isFrac,
        difficulty: dish.difficulty,
        kcal: round1(totals.kcal),
        protein: round1(totals.protein),
        fat: round1(totals.fat),
        carb: round1(totals.carb),
        steps: dish.steps,
        tags: dish.tags,
        source: "CATALOG",
        ingredients: {
          create: resolved.map(({ ingredient, amount, unit, note }) => ({
            ingredientId: ingredient.id,
            amount,
            unit,
            note,
          })),
        },
      },
    });
  }

  if (insaneDishes.length > 0) {
    throw new Error(
      `Seed остановлен: ${insaneDishes.length} блюдо(а) не прошли сан-чек isKcalSane (§7.5).\n` +
        insaneDishes.map((m) => `  - ${m}`).join("\n")
    );
  }
}

/**
 * Считает эмбеддинги (§7.1 шаг 4, Фаза 5) для всех ингредиентов и пишет их в
 * vector-колонку raw SQL (Prisma Client не умеет читать/писать Unsupported
 * типы, см. schema.prisma). Текст эмбеддинга = nameNormalized — то же самое,
 * что эмбеддит matching.ts на запросе (services/matching.ts, matchSemantic),
 * иначе сравнение было бы не consistent. Падает явно, если после записи
 * остался хоть один ингредиент без вектора (§7.4 сан-чек) — не "тихий ноль".
 */
async function seedEmbeddings(ingredientMap: Map<string, Ingredient>): Promise<void> {
  const entries = [...ingredientMap.values()];
  const texts = entries.map((i) => i.nameNormalized);

  const vectors = await embedBatch(texts);
  if (vectors.length !== entries.length) {
    throw new Error(
      `Ошибка эмбеддингов: получено ${vectors.length} векторов на ${entries.length} ингредиентов`
    );
  }

  for (let i = 0; i < entries.length; i++) {
    const literal = toVectorLiteral(vectors[i]);
    await prisma.$executeRaw`UPDATE "Ingredient" SET "embedding" = ${literal}::vector WHERE id = ${entries[i].id}`;
  }

  const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM "Ingredient" WHERE "embedding" IS NULL
  `;
  if (count > 0n) {
    throw new Error(`Ошибка эмбеддингов: у ${count} ингредиент(ов) остался пустой embedding после seed`);
  }
}

async function main() {
  console.log("Сидирую ингредиенты...");
  const ingredientMap = await seedIngredients();
  const categories = new Set(INGREDIENTS.map((i) => i.category));
  console.log(`  ${ingredientMap.size} ингредиентов, категорий покрыто: ${categories.size} / 15`);

  console.log("Сидирую каталог блюд...");
  await seedDishes(ingredientMap);
  console.log(`  ${DISHES.length} блюд создано/обновлено, 0 варнингов isKcalSane`);

  console.log("Считаю эмбеддинги ингредиентов (может занять минуту при первом запуске)...");
  await seedEmbeddings(ingredientMap);
  console.log(`  эмбеддинги посчитаны для всех ${ingredientMap.size} ингредиентов`);
}

main()
  .catch((err) => {
    console.error("Seed завершился с ошибкой:");
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
