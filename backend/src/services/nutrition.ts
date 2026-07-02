// Расчёт КБЖУ блюда из состава ингредиентов (§7.5 спецификации).
// Переиспользуется seed-скриптом и (в следующих фазах) эндпоинтами создания/редактирования блюд.

const PIECE_UNITS = new Set(["шт", "шт."]);

export interface NutritionIngredientInput {
  name: string;
  hasNutrition: boolean;
  kcal100: number | null;
  protein100: number | null;
  fat100: number | null;
  carb100: number | null;
  pieceMassG: number | null;
}

export interface NutritionItemInput {
  ingredient: NutritionIngredientInput;
  amount: number;
  unit: string;
}

export interface NutritionTotals {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
}

/** Переводит количество в граммы. Для "шт" требует заполненный pieceMassG. */
export function toGrams(amount: number, unit: string, ingredientName: string, pieceMassG: number | null): number {
  if (PIECE_UNITS.has(unit)) {
    if (pieceMassG == null) {
      throw new Error(
        `Ошибка данных: ингредиент "${ingredientName}" используется в единице "шт", но pieceMassG не заполнен`
      );
    }
    return amount * pieceMassG;
  }
  // "г" и "мл" считаем 1:1 — упрощение для v1 (см. §7.5)
  return amount;
}

/** Считает суммарный КБЖУ блюда из его состава. Бросает ошибку при некорректных данных ингредиентов. */
export function computeDishNutrition(items: NutritionItemInput[]): NutritionTotals {
  const totals: NutritionTotals = { kcal: 0, protein: 0, fat: 0, carb: 0 };

  for (const { ingredient, amount, unit } of items) {
    if (
      !ingredient.hasNutrition ||
      ingredient.kcal100 == null ||
      ingredient.protein100 == null ||
      ingredient.fat100 == null ||
      ingredient.carb100 == null
    ) {
      throw new Error(
        `Ошибка данных: ингредиент "${ingredient.name}" не имеет КБЖУ (hasNutrition=false) и не может использоваться в блюде`
      );
    }

    const grams = toGrams(amount, unit, ingredient.name, ingredient.pieceMassG);
    const factor = grams / 100;
    totals.kcal += factor * ingredient.kcal100;
    totals.protein += factor * ingredient.protein100;
    totals.fat += factor * ingredient.fat100;
    totals.carb += factor * ingredient.carb100;
  }

  return totals;
}

/** Сан-чек §7.5: kcal ≈ 4*protein + 9*fat + 4*carb, допуск ±15%. */
export function isKcalSane(totals: NutritionTotals): boolean {
  const derived = 4 * totals.protein + 9 * totals.fat + 4 * totals.carb;
  if (derived === 0) return totals.kcal === 0;
  const deviation = Math.abs(totals.kcal - derived) / derived;
  return deviation <= 0.15;
}
