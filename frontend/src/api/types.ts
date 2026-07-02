// Типы ответов бэкенда (§4, §8 спецификации). Держим в ручную синхронизации
// со схемой Prisma и сериализаторами backend/src/services/dishCard.ts,
// backend/src/routes/shopping.ts — в v1 нет общего пакета типов между
// фронтом и бэком.
export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type IngredientCategory =
  | "DAIRY"
  | "MEAT_FISH"
  | "EGGS"
  | "VEGETABLES"
  | "FRUITS"
  | "GRAINS_PASTA"
  | "BAKERY"
  | "OILS_SAUCES"
  | "SPICES"
  | "NUTS_SEEDS"
  | "SWEETS"
  | "BEVERAGES"
  | "FROZEN"
  | "CANNED"
  | "OTHER";

export interface DishCardIngredient {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
  note: string | null;
}

export interface DishCard {
  id: string;
  name: string;
  description: string;
  mealType: MealType;
  cookTimeMin: number;
  servings: number;
  isFrac: boolean;
  difficulty: Difficulty;
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
  steps: string[];
  tags: string[];
  source: string;
  createdAt: string;
  ingredients: DishCardIngredient[];
}

export interface Ingredient {
  id: string;
  name: string;
  nameNormalized: string;
  aliases: string[];
  category: IngredientCategory;
  kcal100: number | null;
  protein100: number | null;
  fat100: number | null;
  carb100: number | null;
  pieceMassG: number | null;
  defaultUnit: string;
  hasNutrition: boolean;
  source: string;
  createdAt: string;
}

export interface ShoppingItem {
  id: string;
  ingredientId: string | null;
  name: string;
  category: IngredientCategory;
  amount: number | null;
  unit: string | null;
  checked: boolean;
  source: string;
  createdAt: string;
}

export interface ShoppingGroup {
  category: IngredientCategory;
  items: ShoppingItem[];
}

export type Goal = "DIET" | "MAINTENANCE" | "MASS";

export interface MenuGenerateRequest {
  targetKcal: number;
  protein?: number;
  fat?: number;
  carb?: number;
  goal: Goal;
}

export interface MenuReplaceMealRequest {
  targetKcal: number;
  protein?: number;
  fat?: number;
  carb?: number;
  goal: Goal;
  meals: { mealType: MealType; dishId: string; portionScale: number }[];
  mealType: MealType;
}

export interface MenuMeal {
  mealType: MealType;
  dish: DishCard;
  portionScale: number;
}

export interface MenuTotals {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
}

export interface MenuDeviation {
  kcalAbsolute: number;
  kcalPercent: number;
}

export interface MenuPlan {
  meals: MenuMeal[];
  totals: MenuTotals;
  deviation: MenuDeviation;
}
