// Оптимизатор дневного меню (§7.3 спецификации): жадный подбор блюда на каждый
// приём пищи из каталога + локальная коррекция масштаба порций, без ИИ и без
// внешних библиотек оптимизации — по спецификации этого достаточно для v1.
import type { MealType } from "@prisma/client";
import type { DishWithIngredients } from "./dishCard";

export type Goal = "DIET" | "MAINTENANCE" | "MASS";

export interface MenuGenerateInput {
  targetKcal: number;
  protein?: number;
  fat?: number;
  carb?: number;
  goal: Goal;
}

export interface MenuMeal {
  mealType: MealType;
  dish: DishWithIngredients;
  portionScale: number;
}

export interface MenuTotals {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
}

// Отклонение итога плана от targetKcal. Абсолютное — в ккал (может быть
// отрицательным, если план вышел ниже цели); percent — то же самое в процентах
// от targetKcal, тоже со знаком.
export interface MenuDeviation {
  kcalAbsolute: number;
  kcalPercent: number;
}

export interface MenuPlan {
  meals: MenuMeal[];
  totals: MenuTotals;
  deviation: MenuDeviation;
}

export class MenuUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuUnreachableError";
  }
}

// Цель → доли ккал по БЖУ, когда Б/Ж/У не заданы явно (§7.3 п.1).
const GOAL_MACRO_KCAL_SHARE: Record<Goal, { protein: number; fat: number; carb: number }> = {
  DIET: { protein: 0.4, fat: 0.3, carb: 0.3 },
  MAINTENANCE: { protein: 0.3, fat: 0.3, carb: 0.4 },
  MASS: { protein: 0.3, fat: 0.25, carb: 0.45 },
};

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARB = 4;

const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

// Доли ккал по приёмам пищи (§7.3 п.2).
const MEAL_FRACTIONS_WITH_SNACK: Record<MealType, number> = {
  BREAKFAST: 0.25,
  LUNCH: 0.35,
  DINNER: 0.3,
  SNACK: 0.1,
};

// Перекус опционален: если его не включаем, его 10% пропорционально
// перераспределяются на завтрак/обед/ужин.
const MEAL_TYPES_NO_SNACK: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];
const NO_SNACK_FRACTION_SUM = MEAL_TYPES_NO_SNACK.reduce((sum, mt) => sum + MEAL_FRACTIONS_WITH_SNACK[mt], 0);
const MEAL_FRACTIONS_NO_SNACK: Record<MealType, number> = Object.fromEntries(
  MEAL_TYPES_NO_SNACK.map((mt) => [mt, MEAL_FRACTIONS_WITH_SNACK[mt] / NO_SNACK_FRACTION_SUM])
) as Record<MealType, number>;

const TOLERANCE = 0.05;
const FRAC_SCALE_MIN = 0.5;
const FRAC_SCALE_MAX = 2.0;
const CANDIDATE_POOL_SIZE = 4;

interface MacroTargets {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
}

function resolveDailyMacroTargets(input: MenuGenerateInput): MacroTargets {
  const share = GOAL_MACRO_KCAL_SHARE[input.goal];
  return {
    kcal: input.targetKcal,
    protein: input.protein ?? (input.targetKcal * share.protein) / KCAL_PER_G_PROTEIN,
    fat: input.fat ?? (input.targetKcal * share.fat) / KCAL_PER_G_FAT,
    carb: input.carb ?? (input.targetKcal * share.carb) / KCAL_PER_G_CARB,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Лучший множитель порции под целевые ккал приёма пищи (§7.3 п.3):
// isFrac=true — любой множитель 0.5–2.0×; isFrac=false — только целые кратные.
function bestScale(dishKcal: number, targetKcal: number, isFrac: boolean): number {
  if (dishKcal <= 0) return 1;
  if (isFrac) {
    return clamp(targetKcal / dishKcal, FRAC_SCALE_MIN, FRAC_SCALE_MAX);
  }
  const ideal = targetKcal / dishKcal;
  const candidates = new Set<number>([1, Math.max(1, Math.floor(ideal)), Math.max(1, Math.ceil(ideal))]);
  let best = 1;
  let bestDiff = Infinity;
  for (const scale of candidates) {
    const diff = Math.abs(dishKcal * scale - targetKcal);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = scale;
    }
  }
  return best;
}

interface Candidate {
  dish: DishWithIngredients;
  scale: number;
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
  score: number;
}

function buildCandidate(dish: DishWithIngredients, mealTargets: MacroTargets): Candidate {
  const scale = bestScale(dish.kcal, mealTargets.kcal, dish.isFrac);
  const kcal = dish.kcal * scale;
  const protein = dish.protein * scale;
  const fat = dish.fat * scale;
  const carb = dish.carb * scale;

  const relDev = (actual: number, target: number) => (target > 0 ? Math.abs(actual - target) / target : 0);
  // ккал — основной критерий отбора (совпадает с критерием приёмки по ккал),
  // БЖУ учитываются как вторичный фактор при выборе между похожими блюдами.
  const score =
    0.6 * relDev(kcal, mealTargets.kcal) +
    (0.4 / 3) * relDev(protein, mealTargets.protein) +
    (0.4 / 3) * relDev(fat, mealTargets.fat) +
    (0.4 / 3) * relDev(carb, mealTargets.carb);

  return { dish, scale, kcal, protein, fat, carb, score };
}

function topCandidates(dishes: DishWithIngredients[], mealTargets: MacroTargets, poolSize: number): Candidate[] {
  return dishes
    .map((dish) => buildCandidate(dish, mealTargets))
    .sort((a, b) => a.score - b.score)
    .slice(0, poolSize);
}

interface PlanItem {
  mealType: MealType;
  candidate: Candidate;
}

// Добор (§7.3 п.4): сдвигает суммарное отклонение по ккал на блюда с
// isFrac=true в плане (только они допускают непрерывное масштабирование),
// в пределах разрешённого множителя 0.5–2.0×.
function correctPlan(items: PlanItem[], targetKcal: number): PlanItem[] {
  const totalKcal = items.reduce((sum, i) => sum + i.candidate.kcal, 0);
  const diff = targetKcal - totalKcal;
  if (Math.abs(diff) / targetKcal <= TOLERANCE) return items;

  const fracItems = items.filter((i) => i.candidate.dish.isFrac);
  if (fracItems.length === 0) return items;

  const currentFracKcal = fracItems.reduce((sum, i) => sum + i.candidate.kcal, 0);
  if (currentFracKcal <= 0) return items;

  const targetFracKcal = currentFracKcal + diff;
  const factor = targetFracKcal / currentFracKcal;

  return items.map((item) => {
    if (!item.candidate.dish.isFrac) return item;
    const dish = item.candidate.dish;
    const newScale = clamp(item.candidate.scale * factor, FRAC_SCALE_MIN, FRAC_SCALE_MAX);
    return {
      mealType: item.mealType,
      candidate: {
        dish,
        scale: newScale,
        kcal: dish.kcal * newScale,
        protein: dish.protein * newScale,
        fat: dish.fat * newScale,
        carb: dish.carb * newScale,
        score: item.candidate.score,
      },
    };
  });
}

function planTotals(items: PlanItem[]): MenuTotals {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.candidate.kcal,
      protein: acc.protein + i.candidate.protein,
      fat: acc.fat + i.candidate.fat,
      carb: acc.carb + i.candidate.carb,
    }),
    { kcal: 0, protein: 0, fat: 0, carb: 0 }
  );
}

function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])), [[]]);
}

interface Attempt {
  items: PlanItem[];
  totals: MenuTotals;
  deviationRatio: number;
}

// Перебирает top-N кандидатов на каждый приём пищи (декартово произведение —
// каталог мал, счёт комбинаций остаётся тривиальным), для каждой комбинации
// прогоняет добор и возвращает ВСЕ получившиеся варианты (не только лучший):
// по ним затем случайно выбирается план (см. generateMenu), чтобы повторное
// нажатие "Собрать меню" предлагало другой вариант, а не всегда один и тот же.
function attemptsForMealSet(
  mealTypes: MealType[],
  dishesByType: Map<MealType, DishWithIngredients[]>,
  fractions: Record<MealType, number>,
  daily: MacroTargets
): Attempt[] | null {
  const perMealCandidates = mealTypes.map((mealType) => {
    const dishes = dishesByType.get(mealType) ?? [];
    if (dishes.length === 0) return [];
    const fraction = fractions[mealType];
    const mealTargets: MacroTargets = {
      kcal: daily.kcal * fraction,
      protein: daily.protein * fraction,
      fat: daily.fat * fraction,
      carb: daily.carb * fraction,
    };
    return topCandidates(dishes, mealTargets, CANDIDATE_POOL_SIZE).map((candidate) => ({ mealType, candidate }));
  });

  if (perMealCandidates.some((list) => list.length === 0)) return null;

  return cartesian(perMealCandidates).map((combo) => {
    const corrected = correctPlan(combo, daily.kcal);
    const totals = planTotals(corrected);
    const deviationRatio = Math.abs(totals.kcal - daily.kcal) / daily.kcal;
    return { items: corrected, totals, deviationRatio };
  });
}

export interface CurrentMenuMeal {
  mealType: MealType;
  dishId: string;
  portionScale: number;
}

// Замена одного блюда плана (кнопка "Заменить" на экране меню, §6.2): подбирает
// другое блюдо того же mealType (кроме текущего) и пересчитывает план целиком —
// остальные приёмы пищи фиксируются на своих текущих блюдах, но их масштаб
// порции может быть скорректирован добором (§7.3 п.4), чтобы итог остался в
// пределах ±5% от цели, как и при первичной сборке меню.
export function replaceMenuMeal(
  input: MenuGenerateInput,
  catalog: DishWithIngredients[],
  currentMeals: CurrentMenuMeal[],
  mealTypeToReplace: MealType
): MenuPlan {
  const daily = resolveDailyMacroTargets(input);

  const dishesByType = new Map<MealType, DishWithIngredients[]>();
  for (const dish of catalog) {
    const list = dishesByType.get(dish.mealType) ?? [];
    list.push(dish);
    dishesByType.set(dish.mealType, list);
  }

  const mealTypes = currentMeals.map((m) => m.mealType);
  if (!mealTypes.includes(mealTypeToReplace)) {
    throw new MenuUnreachableError("Этого приёма пищи нет в текущем плане.");
  }
  const fractions = mealTypes.includes("SNACK") ? MEAL_FRACTIONS_WITH_SNACK : MEAL_FRACTIONS_NO_SNACK;
  const excludeDishIds = new Set(currentMeals.map((m) => m.dishId));

  const perMealCandidates: PlanItem[][] = mealTypes.map((mealType) => {
    const fraction = fractions[mealType];
    const mealTargets: MacroTargets = {
      kcal: daily.kcal * fraction,
      protein: daily.protein * fraction,
      fat: daily.fat * fraction,
      carb: daily.carb * fraction,
    };

    if (mealType !== mealTypeToReplace) {
      // Остальные приёмы пищи остаются на текущем блюде — меняется только
      // масштаб порции (в добор ниже), сам выбор блюда не трогаем.
      const current = currentMeals.find((m) => m.mealType === mealType);
      const dish = current && catalog.find((d) => d.id === current.dishId);
      if (!dish) return [];
      return [{ mealType, candidate: buildCandidate(dish, mealTargets) }];
    }

    const dishes = (dishesByType.get(mealType) ?? []).filter((d) => !excludeDishIds.has(d.id));
    if (dishes.length === 0) return [];
    return topCandidates(dishes, mealTargets, CANDIDATE_POOL_SIZE).map((candidate) => ({ mealType, candidate }));
  });

  if (perMealCandidates.some((list) => list.length === 0)) {
    throw new MenuUnreachableError(
      "В каталоге нет другого блюда этого типа приёма пищи, которым можно было бы заменить текущее."
    );
  }

  const attempts: Attempt[] = cartesian(perMealCandidates).map((combo) => {
    const corrected = correctPlan(combo, daily.kcal);
    const totals = planTotals(corrected);
    const deviationRatio = Math.abs(totals.kcal - daily.kcal) / daily.kcal;
    return { items: corrected, totals, deviationRatio };
  });

  const withinTolerance = attempts.filter((a) => a.deviationRatio <= TOLERANCE);
  const best =
    withinTolerance.length > 0
      ? withinTolerance[Math.floor(Math.random() * withinTolerance.length)]
      : attempts.reduce((a, b) => (a.deviationRatio <= b.deviationRatio ? a : b));

  if (best.deviationRatio > TOLERANCE) {
    throw new MenuUnreachableError(
      "Не удалось подобрать замену этому блюду так, чтобы план остался в пределах ±5% от цели по калориям. " +
        "Попробуйте изменить целевую калорийность или оставьте текущее блюдо."
    );
  }

  return finalizeMenuPlan(best, input);
}

function finalizeMenuPlan(best: Attempt, input: MenuGenerateInput): MenuPlan {
  const meals: MenuMeal[] = [...best.items]
    .sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType))
    .map((item) => ({
      mealType: item.mealType,
      dish: item.candidate.dish,
      portionScale: Math.round(item.candidate.scale * 100) / 100,
    }));

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const totals: MenuTotals = {
    kcal: round1(best.totals.kcal),
    protein: round1(best.totals.protein),
    fat: round1(best.totals.fat),
    carb: round1(best.totals.carb),
  };
  const deviation: MenuDeviation = {
    kcalAbsolute: round1(totals.kcal - input.targetKcal),
    kcalPercent: round1(((totals.kcal - input.targetKcal) / input.targetKcal) * 100),
  };

  return { meals, totals, deviation };
}

export function generateMenu(input: MenuGenerateInput, catalog: DishWithIngredients[]): MenuPlan {
  const daily = resolveDailyMacroTargets(input);

  const dishesByType = new Map<MealType, DishWithIngredients[]>();
  for (const dish of catalog) {
    const list = dishesByType.get(dish.mealType) ?? [];
    list.push(dish);
    dishesByType.set(dish.mealType, list);
  }

  const withSnack = attemptsForMealSet(MEAL_ORDER, dishesByType, MEAL_FRACTIONS_WITH_SNACK, daily);
  const withoutSnack = attemptsForMealSet(MEAL_TYPES_NO_SNACK, dishesByType, MEAL_FRACTIONS_NO_SNACK, daily);

  const attempts = [...(withSnack ?? []), ...(withoutSnack ?? [])];
  if (attempts.length === 0) {
    throw new MenuUnreachableError(
      "В каталоге не хватает блюд, чтобы собрать меню: не для всех обязательных приёмов пищи (завтрак/обед/ужин) нашлось хотя бы одно блюдо."
    );
  }

  // Среди всех вариантов, укладывающихся в допуск ±5% (§7.3 п.4), выбираем
  // случайный, а не всегда наиболее точный по ккал — так пользователь может
  // повторным нажатием "Собрать меню" увидеть другой валидный план. Если ни
  // один вариант не уложился в допуск, берём ближайший к цели для сообщения
  // об ошибке ниже.
  const withinTolerance = attempts.filter((a) => a.deviationRatio <= TOLERANCE);
  const best =
    withinTolerance.length > 0
      ? withinTolerance[Math.floor(Math.random() * withinTolerance.length)]
      : attempts.reduce((a, b) => (a.deviationRatio <= b.deviationRatio ? a : b));

  if (best.deviationRatio > TOLERANCE) {
    const achieved = Math.round(best.totals.kcal);
    throw new MenuUnreachableError(
      `На ${input.targetKcal} ккал не удаётся собрать план в пределах ±5% даже из самых лёгких/тяжёлых блюд каталога. ` +
        `Ближайший вариант — около ${achieved} ккал. Попробуйте изменить целевую калорийность.`
    );
  }

  return finalizeMenuPlan(best, input);
}
