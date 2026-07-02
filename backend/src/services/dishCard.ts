// DishCard — единый формат ответа для блюда (§8, последний абзац спецификации):
// все поля Dish + массив ингредиентов { ingredientId, name, amount, unit, note }.
// Собран один раз здесь и переиспользуется во всех роутах, отдающих блюда
// (dishes.ts, saved.ts, shopping.ts/from-dish).
import type { Dish, DishIngredient, Ingredient } from "@prisma/client";

export type DishWithIngredients = Dish & {
  ingredients: (DishIngredient & { ingredient: Ingredient })[];
};

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
  mealType: Dish["mealType"];
  cookTimeMin: number;
  servings: number;
  isFrac: boolean;
  difficulty: Dish["difficulty"];
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
  steps: string[];
  tags: string[];
  source: Dish["source"];
  createdAt: Date;
  ingredients: DishCardIngredient[];
}

// Prisma include, гарантирующий наличие данных, нужных toDishCard.
export const dishWithIngredientsInclude = {
  ingredients: { include: { ingredient: true } },
} as const;

export function toDishCard(dish: DishWithIngredients): DishCard {
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    mealType: dish.mealType,
    cookTimeMin: dish.cookTimeMin,
    servings: dish.servings,
    isFrac: dish.isFrac,
    difficulty: dish.difficulty,
    kcal: dish.kcal,
    protein: dish.protein,
    fat: dish.fat,
    carb: dish.carb,
    steps: dish.steps,
    tags: dish.tags,
    source: dish.source,
    createdAt: dish.createdAt,
    ingredients: dish.ingredients.map((di) => ({
      ingredientId: di.ingredientId,
      name: di.ingredient.name,
      amount: di.amount,
      unit: di.unit,
      note: di.note,
    })),
  };
}
