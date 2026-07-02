// Маппинг enum → русские подписи (§10 спецификации: весь интерфейс на русском).
import type { Difficulty, Goal, IngredientCategory, MealType } from "../api/types";

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: "Завтрак",
  LUNCH: "Обед",
  DINNER: "Ужин",
  SNACK: "Перекус",
};

export const GOAL_LABELS: Record<Goal, string> = {
  DIET: "Похудение",
  MAINTENANCE: "Поддержание веса",
  MASS: "Набор массы",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Легко",
  MEDIUM: "Средне",
  HARD: "Сложно",
};

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  DAIRY: "Молочные продукты",
  MEAT_FISH: "Мясо и рыба",
  EGGS: "Яйца",
  VEGETABLES: "Овощи",
  FRUITS: "Фрукты и ягоды",
  GRAINS_PASTA: "Крупы и макароны",
  BAKERY: "Хлеб и выпечка",
  OILS_SAUCES: "Масла и соусы",
  SPICES: "Специи и приправы",
  NUTS_SEEDS: "Орехи и семена",
  SWEETS: "Сладкое",
  BEVERAGES: "Напитки",
  FROZEN: "Заморозка",
  CANNED: "Консервы",
  OTHER: "Прочее",
};
