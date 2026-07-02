import { Ingredient, IngredientCategory, MealType, Difficulty } from "@prisma/client";
import { prisma } from "../src/db";
import { computeDishNutrition, isKcalSane } from "../src/services/nutrition";
import { normalizeName } from "../src/services/matching";

const round1 = (n: number) => Math.round(n * 10) / 10;

interface SeedIngredient {
  name: string;
  aliases: string[];
  category: IngredientCategory;
  kcal100: number;
  protein100: number;
  fat100: number;
  carb100: number;
  pieceMassG?: number;
  defaultUnit: string;
}

// Обычные продукты из супермаркета, покрывающие все 15 категорий IngredientCategory.
// КБЖУ — типовые табличные значения на 100 г.
const INGREDIENTS: SeedIngredient[] = [
  // DAIRY
  { name: "Молоко 3.2%", aliases: ["молоко"], category: "DAIRY", kcal100: 60, protein100: 3.0, fat100: 3.2, carb100: 4.7, defaultUnit: "мл" },
  { name: "Кефир 1%", aliases: ["кефир"], category: "DAIRY", kcal100: 40, protein100: 3.0, fat100: 1.0, carb100: 4.0, defaultUnit: "мл" },
  { name: "Творог 5%", aliases: ["творог"], category: "DAIRY", kcal100: 121, protein100: 17.2, fat100: 5.0, carb100: 1.8, defaultUnit: "г" },
  { name: "Йогурт натуральный", aliases: ["йогурт"], category: "DAIRY", kcal100: 60, protein100: 4.3, fat100: 2.0, carb100: 6.2, defaultUnit: "г" },
  { name: "Сыр твёрдый", aliases: ["сыр", "сыр голландский"], category: "DAIRY", kcal100: 352, protein100: 26, fat100: 27, carb100: 0, defaultUnit: "г" },
  { name: "Сметана 20%", aliases: ["сметана"], category: "DAIRY", kcal100: 206, protein100: 2.8, fat100: 20, carb100: 3.2, defaultUnit: "г" },

  // MEAT_FISH
  { name: "Куриное филе", aliases: ["курица грудка", "грудка куриная", "филе курицы"], category: "MEAT_FISH", kcal100: 113, protein100: 23.6, fat100: 1.9, carb100: 0.4, defaultUnit: "г" },
  { name: "Куриное бедро", aliases: ["бедро куриное", "бедро курицы"], category: "MEAT_FISH", kcal100: 185, protein100: 16.8, fat100: 12.4, carb100: 0, defaultUnit: "г" },
  { name: "Говядина", aliases: ["говяжья вырезка", "вырезка говяжья"], category: "MEAT_FISH", kcal100: 187, protein100: 18.6, fat100: 12.4, carb100: 0, defaultUnit: "г" },
  { name: "Свинина", aliases: ["свиная шея", "шея свиная"], category: "MEAT_FISH", kcal100: 260, protein100: 16, fat100: 21, carb100: 0, defaultUnit: "г" },
  { name: "Лосось", aliases: ["филе лосося", "сёмга"], category: "MEAT_FISH", kcal100: 142, protein100: 19.8, fat100: 6.3, carb100: 0, defaultUnit: "г" },
  { name: "Треска", aliases: ["филе трески"], category: "MEAT_FISH", kcal100: 78, protein100: 17.7, fat100: 0.7, carb100: 0, defaultUnit: "г" },

  // EGGS
  { name: "Яйцо куриное", aliases: ["яйцо", "яйца куриные"], category: "EGGS", kcal100: 157, protein100: 12.7, fat100: 10.9, carb100: 0.7, pieceMassG: 55, defaultUnit: "шт" },

  // VEGETABLES
  { name: "Картофель", aliases: ["картошка"], category: "VEGETABLES", kcal100: 77, protein100: 2.0, fat100: 0.4, carb100: 16.3, defaultUnit: "г" },
  { name: "Морковь", aliases: [], category: "VEGETABLES", kcal100: 35, protein100: 1.3, fat100: 0.1, carb100: 6.9, defaultUnit: "г" },
  { name: "Лук репчатый", aliases: ["лук"], category: "VEGETABLES", kcal100: 41, protein100: 1.4, fat100: 0, carb100: 9.3, defaultUnit: "г" },
  { name: "Чеснок", aliases: [], category: "VEGETABLES", kcal100: 149, protein100: 6.5, fat100: 0.5, carb100: 29.9, defaultUnit: "г" },
  { name: "Помидор", aliases: ["томат"], category: "VEGETABLES", kcal100: 20, protein100: 1.1, fat100: 0.2, carb100: 3.9, pieceMassG: 120, defaultUnit: "шт" },
  { name: "Огурец", aliases: [], category: "VEGETABLES", kcal100: 15, protein100: 0.8, fat100: 0.1, carb100: 2.8, pieceMassG: 100, defaultUnit: "шт" },
  { name: "Капуста белокочанная", aliases: ["капуста"], category: "VEGETABLES", kcal100: 27, protein100: 1.8, fat100: 0.1, carb100: 4.7, defaultUnit: "г" },
  { name: "Болгарский перец", aliases: ["перец сладкий"], category: "VEGETABLES", kcal100: 27, protein100: 1.3, fat100: 0, carb100: 5.3, pieceMassG: 110, defaultUnit: "шт" },
  { name: "Брокколи", aliases: [], category: "VEGETABLES", kcal100: 34, protein100: 2.8, fat100: 0.4, carb100: 4.0, defaultUnit: "г" },

  // FRUITS
  { name: "Банан", aliases: [], category: "FRUITS", kcal100: 96, protein100: 1.5, fat100: 0.2, carb100: 21.8, pieceMassG: 120, defaultUnit: "шт" },
  { name: "Яблоко", aliases: [], category: "FRUITS", kcal100: 47, protein100: 0.4, fat100: 0.4, carb100: 9.8, pieceMassG: 180, defaultUnit: "шт" },
  { name: "Апельсин", aliases: [], category: "FRUITS", kcal100: 43, protein100: 0.9, fat100: 0.2, carb100: 8.1, pieceMassG: 150, defaultUnit: "шт" },
  { name: "Лимон", aliases: [], category: "FRUITS", kcal100: 16, protein100: 0.9, fat100: 0.1, carb100: 3.0, pieceMassG: 100, defaultUnit: "шт" },
  { name: "Авокадо", aliases: [], category: "FRUITS", kcal100: 160, protein100: 2.0, fat100: 14.7, carb100: 8.5, pieceMassG: 200, defaultUnit: "шт" },

  // GRAINS_PASTA
  { name: "Рис длиннозёрный", aliases: ["рис"], category: "GRAINS_PASTA", kcal100: 344, protein100: 7.1, fat100: 0.7, carb100: 74.5, defaultUnit: "г" },
  { name: "Гречка", aliases: ["гречневая крупа"], category: "GRAINS_PASTA", kcal100: 313, protein100: 12.6, fat100: 3.3, carb100: 62.1, defaultUnit: "г" },
  { name: "Овсяные хлопья", aliases: ["овсянка"], category: "GRAINS_PASTA", kcal100: 342, protein100: 12.3, fat100: 6.1, carb100: 59.5, defaultUnit: "г" },
  { name: "Макароны", aliases: ["паста", "спагетти"], category: "GRAINS_PASTA", kcal100: 337, protein100: 10.4, fat100: 1.1, carb100: 70.5, defaultUnit: "г" },
  { name: "Булгур", aliases: [], category: "GRAINS_PASTA", kcal100: 342, protein100: 12.3, fat100: 1.3, carb100: 63.4, defaultUnit: "г" },
  { name: "Киноа", aliases: [], category: "GRAINS_PASTA", kcal100: 368, protein100: 14.1, fat100: 6.1, carb100: 57.2, defaultUnit: "г" },

  // BAKERY
  { name: "Хлеб пшеничный", aliases: ["батон"], category: "BAKERY", kcal100: 265, protein100: 7.6, fat100: 1.0, carb100: 51.4, pieceMassG: 30, defaultUnit: "шт" },
  { name: "Хлеб цельнозерновой", aliases: [], category: "BAKERY", kcal100: 250, protein100: 8.5, fat100: 2.5, carb100: 45.0, pieceMassG: 35, defaultUnit: "шт" },
  { name: "Лаваш", aliases: [], category: "BAKERY", kcal100: 236, protein100: 7.9, fat100: 1.1, carb100: 47.6, pieceMassG: 90, defaultUnit: "шт" },

  // OILS_SAUCES
  { name: "Масло оливковое", aliases: [], category: "OILS_SAUCES", kcal100: 898, protein100: 0, fat100: 99.8, carb100: 0, defaultUnit: "мл" },
  { name: "Масло подсолнечное", aliases: [], category: "OILS_SAUCES", kcal100: 899, protein100: 0, fat100: 99.9, carb100: 0, defaultUnit: "мл" },
  { name: "Масло сливочное", aliases: [], category: "OILS_SAUCES", kcal100: 748, protein100: 0.5, fat100: 82.5, carb100: 0.8, defaultUnit: "г" },
  { name: "Соевый соус", aliases: [], category: "OILS_SAUCES", kcal100: 50, protein100: 6.0, fat100: 0, carb100: 6.5, defaultUnit: "мл" },

  // SPICES
  { name: "Соль", aliases: [], category: "SPICES", kcal100: 0, protein100: 0, fat100: 0, carb100: 0, defaultUnit: "г" },
  { name: "Перец чёрный молотый", aliases: ["перец чёрный"], category: "SPICES", kcal100: 251, protein100: 10.4, fat100: 3.3, carb100: 38.7, defaultUnit: "г" },
  { name: "Куркума", aliases: [], category: "SPICES", kcal100: 312, protein100: 9.7, fat100: 3.3, carb100: 58.0, defaultUnit: "г" },
  { name: "Паприка сладкая", aliases: ["паприка"], category: "SPICES", kcal100: 282, protein100: 14.1, fat100: 13.0, carb100: 34.9, defaultUnit: "г" },

  // NUTS_SEEDS
  { name: "Грецкий орех", aliases: [], category: "NUTS_SEEDS", kcal100: 656, protein100: 15.2, fat100: 65.2, carb100: 13.7, defaultUnit: "г" },
  { name: "Миндаль", aliases: [], category: "NUTS_SEEDS", kcal100: 609, protein100: 21.2, fat100: 49.9, carb100: 21.7, defaultUnit: "г" },
  { name: "Семена подсолнечника", aliases: ["семечки"], category: "NUTS_SEEDS", kcal100: 584, protein100: 20.7, fat100: 52.9, carb100: 10.5, defaultUnit: "г" },

  // SWEETS
  { name: "Мёд", aliases: [], category: "SWEETS", kcal100: 329, protein100: 0.8, fat100: 0, carb100: 81.5, defaultUnit: "г" },
  { name: "Сахар", aliases: [], category: "SWEETS", kcal100: 398, protein100: 0, fat100: 0, carb100: 99.8, defaultUnit: "г" },
  { name: "Шоколад тёмный", aliases: ["тёмный шоколад"], category: "SWEETS", kcal100: 546, protein100: 4.9, fat100: 30.9, carb100: 55.6, defaultUnit: "г" },

  // BEVERAGES
  { name: "Вода питьевая", aliases: ["вода"], category: "BEVERAGES", kcal100: 0, protein100: 0, fat100: 0, carb100: 0, defaultUnit: "мл" },
  { name: "Чай чёрный", aliases: ["заварка чёрного чая"], category: "BEVERAGES", kcal100: 0, protein100: 0, fat100: 0, carb100: 0.3, defaultUnit: "г" },
  { name: "Сок апельсиновый", aliases: [], category: "BEVERAGES", kcal100: 45, protein100: 0.7, fat100: 0.2, carb100: 10.1, defaultUnit: "мл" },

  // FROZEN
  { name: "Овощная смесь замороженная", aliases: [], category: "FROZEN", kcal100: 60, protein100: 2.5, fat100: 0.3, carb100: 11.5, defaultUnit: "г" },
  { name: "Клубника замороженная", aliases: [], category: "FROZEN", kcal100: 33, protein100: 0.8, fat100: 0.1, carb100: 7.7, defaultUnit: "г" },

  // CANNED
  { name: "Фасоль консервированная", aliases: [], category: "CANNED", kcal100: 99, protein100: 6.7, fat100: 0.5, carb100: 16.5, defaultUnit: "г" },
  { name: "Кукуруза консервированная", aliases: [], category: "CANNED", kcal100: 79, protein100: 2.7, fat100: 0.5, carb100: 16.2, defaultUnit: "г" },
  { name: "Тунец консервированный", aliases: ["тунец в собственном соку"], category: "CANNED", kcal100: 96, protein100: 22.0, fat100: 0.7, carb100: 0, defaultUnit: "г" },

  // OTHER
  { name: "Дрожжи хлебопекарные", aliases: ["дрожжи"], category: "OTHER", kcal100: 105, protein100: 8.0, fat100: 1.5, carb100: 17.0, defaultUnit: "г" },
  { name: "Разрыхлитель теста", aliases: ["разрыхлитель"], category: "OTHER", kcal100: 53, protein100: 0, fat100: 0, carb100: 13.0, defaultUnit: "г" },
];

interface SeedDishIngredient {
  name: string;
  amount: number;
  unit: string;
  note?: string;
}

interface SeedDish {
  name: string;
  description: string;
  mealType: MealType;
  cookTimeMin: number;
  servings: number;
  isFrac: boolean;
  difficulty: Difficulty;
  steps: string[];
  tags: string[];
  ingredients: SeedDishIngredient[];
}

// Каталог блюд (§5): минимум 15, распределены по MealType и калорийности.
// КБЖУ не задаётся здесь — считается из состава функцией computeDishNutrition.
const DISHES: SeedDish[] = [
  // --- BREAKFAST ---
  {
    name: "Овсянка с бананом",
    description: "Овсяная каша на молоке с бананом и мёдом",
    mealType: "BREAKFAST",
    cookTimeMin: 10,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское"],
    steps: [
      "Довести молоко до кипения",
      "Всыпать овсяные хлопья, варить 5 минут на слабом огне, помешивая",
      "Нарезать банан кружочками",
      "Подавать кашу с бананом и мёдом сверху",
    ],
    ingredients: [
      { name: "Овсяные хлопья", amount: 50, unit: "г" },
      { name: "Молоко 3.2%", amount: 200, unit: "мл" },
      { name: "Банан", amount: 1, unit: "шт" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Яичница с помидорами",
    description: "Классическая яичница с помидором на сливочном масле",
    mealType: "BREAKFAST",
    cookTimeMin: 10,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро"],
    steps: [
      "Разогреть сковороду со сливочным маслом",
      "Нарезать помидор дольками, выложить на сковороду, обжарить 2 минуты",
      "Разбить яйца поверх помидоров",
      "Посолить, жарить под крышкой 4-5 минут до готовности белка",
    ],
    ingredients: [
      { name: "Яйцо куриное", amount: 2, unit: "шт" },
      { name: "Помидор", amount: 1, unit: "шт" },
      { name: "Масло сливочное", amount: 10, unit: "г" },
      { name: "Соль", amount: 1, unit: "г" },
    ],
  },
  {
    name: "Творог с ягодами",
    description: "Творог с размороженной клубникой и мёдом",
    mealType: "BREAKFAST",
    cookTimeMin: 5,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро", "лёгкое"],
    steps: [
      "Разморозить клубнику",
      "Выложить творог в тарелку",
      "Добавить клубнику и полить мёдом",
    ],
    ingredients: [
      { name: "Творог 5%", amount: 150, unit: "г" },
      { name: "Клубника замороженная", amount: 50, unit: "г" },
      { name: "Мёд", amount: 15, unit: "г" },
    ],
  },
  {
    name: "Тосты с авокадо",
    description: "Тосты из цельнозернового хлеба с авокадо и лимонным соком",
    mealType: "BREAKFAST",
    cookTimeMin: 10,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское"],
    steps: [
      "Обжарить или подсушить ломтики хлеба в тостере",
      "Размять мякоть авокадо вилкой, сбрызнуть лимонным соком",
      "Посолить по вкусу",
      "Намазать авокадо на тосты",
    ],
    ingredients: [
      { name: "Хлеб цельнозерновой", amount: 2, unit: "шт" },
      { name: "Авокадо", amount: 0.5, unit: "шт" },
      { name: "Лимон", amount: 0.1, unit: "шт" },
      { name: "Соль", amount: 1, unit: "г" },
    ],
  },

  // --- LUNCH ---
  {
    name: "Куриный суп с овощами",
    description: "Лёгкий суп с куриным бедром, картофелем и морковью",
    mealType: "LUNCH",
    cookTimeMin: 40,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: [],
    steps: [
      "Отварить куриное бедро до готовности, вынуть, бульон процедить",
      "Нарезать картофель и морковь, лук мелко нарубить",
      "Варить овощи в бульоне 15-20 минут",
      "Вернуть нарезанную курицу в суп, посолить, довести до кипения",
    ],
    ingredients: [
      { name: "Куриное бедро", amount: 150, unit: "г" },
      { name: "Картофель", amount: 150, unit: "г" },
      { name: "Морковь", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Соль", amount: 2, unit: "г" },
    ],
  },
  {
    name: "Гречка с говядиной",
    description: "Сытная гречневая каша с тушёной говядиной и луком",
    mealType: "LUNCH",
    cookTimeMin: 35,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Нарезать говядину кусочками, обжарить на масле до корочки",
      "Добавить нарезанный лук, тушить 10 минут",
      "Влить воду, тушить под крышкой 20 минут до мягкости мяса",
      "Отдельно отварить гречку, подавать вместе",
    ],
    ingredients: [
      { name: "Гречка", amount: 80, unit: "г" },
      { name: "Говядина", amount: 150, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Масло подсолнечное", amount: 10, unit: "мл" },
    ],
  },
  {
    name: "Паста с тунцом",
    description: "Макароны с консервированным тунцом, помидором и оливковым маслом",
    mealType: "LUNCH",
    cookTimeMin: 20,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: [],
    steps: [
      "Отварить макароны согласно инструкции на упаковке",
      "Нарезать помидор кубиками",
      "Слить жидкость с тунца, размять вилкой",
      "Смешать макароны, тунца и помидор, заправить оливковым маслом",
    ],
    ingredients: [
      { name: "Макароны", amount: 90, unit: "г" },
      { name: "Тунец консервированный", amount: 100, unit: "г" },
      { name: "Помидор", amount: 1, unit: "шт" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
    ],
  },
  {
    name: "Плов с курицей",
    description: "Плов с куриным филе, морковью и луком",
    mealType: "LUNCH",
    cookTimeMin: 45,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Нарезать куриное филе кубиками, обжарить на масле",
      "Добавить нарезанные морковь и лук, обжарить 5 минут",
      "Всыпать промытый рис, залить водой на 1.5 см выше уровня риса",
      "Тушить под крышкой на слабом огне 25-30 минут до готовности риса",
    ],
    ingredients: [
      { name: "Рис длиннозёрный", amount: 100, unit: "г" },
      { name: "Куриное филе", amount: 150, unit: "г" },
      { name: "Морковь", amount: 60, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Масло подсолнечное", amount: 15, unit: "мл" },
    ],
  },

  // --- DINNER ---
  {
    name: "Лосось запечённый с брокколи",
    description: "Филе лосося, запечённое с брокколи и лимоном",
    mealType: "DINNER",
    cookTimeMin: 25,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: [],
    steps: [
      "Разогреть духовку до 200°C",
      "Выложить филе лосося и соцветия брокколи на противень",
      "Сбрызнуть оливковым маслом и лимонным соком, посолить",
      "Запекать 15-18 минут до готовности",
    ],
    ingredients: [
      { name: "Лосось", amount: 180, unit: "г" },
      { name: "Брокколи", amount: 150, unit: "г" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
      { name: "Лимон", amount: 0.3, unit: "шт" },
    ],
  },
  {
    name: "Тушёная капуста со свининой",
    description: "Сытное рагу из тушёной капусты со свининой и овощами",
    mealType: "DINNER",
    cookTimeMin: 50,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Нарезать свинину кусочками, обжарить до корочки",
      "Добавить нарезанные лук и морковь, обжарить 5 минут",
      "Добавить нашинкованную капусту, перемешать",
      "Тушить под крышкой на слабом огне 30-35 минут до мягкости капусты",
    ],
    ingredients: [
      { name: "Капуста белокочанная", amount: 200, unit: "г" },
      { name: "Свинина", amount: 150, unit: "г" },
      { name: "Морковь", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Масло подсолнечное", amount: 15, unit: "мл" },
    ],
  },
  {
    name: "Картофельное пюре с треской",
    description: "Нежное картофельное пюре с отварной треской",
    mealType: "DINNER",
    cookTimeMin: 30,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: [],
    steps: [
      "Отварить картофель до готовности, слить воду",
      "Растолочь картофель с молоком и сливочным маслом в пюре",
      "Отварить или приготовить на пару филе трески 10-12 минут",
      "Подавать пюре с треской",
    ],
    ingredients: [
      { name: "Картофель", amount: 200, unit: "г" },
      { name: "Треска", amount: 150, unit: "г" },
      { name: "Молоко 3.2%", amount: 40, unit: "мл" },
      { name: "Масло сливочное", amount: 15, unit: "г" },
    ],
  },
  {
    name: "Салат с тунцом и яйцом",
    description: "Лёгкий салат с тунцом, яйцом, огурцом и помидором",
    mealType: "DINNER",
    cookTimeMin: 15,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["лёгкое"],
    steps: [
      "Отварить яйца вкрутую, остудить и нарезать",
      "Нарезать огурец и помидор кубиками",
      "Слить жидкость с тунца, размять вилкой",
      "Смешать все ингредиенты, заправить оливковым маслом",
    ],
    ingredients: [
      { name: "Тунец консервированный", amount: 100, unit: "г" },
      { name: "Яйцо куриное", amount: 2, unit: "шт" },
      { name: "Огурец", amount: 1, unit: "шт" },
      { name: "Помидор", amount: 1, unit: "шт" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
    ],
  },

  // --- SNACK ---
  {
    name: "Йогурт с орехами",
    description: "Натуральный йогурт с грецкими орехами и мёдом",
    mealType: "SNACK",
    cookTimeMin: 5,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: [
      "Выложить йогурт в пиалу",
      "Измельчить грецкие орехи и посыпать сверху",
      "Полить мёдом",
    ],
    ingredients: [
      { name: "Йогурт натуральный", amount: 150, unit: "г" },
      { name: "Грецкий орех", amount: 20, unit: "г" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Банан с миндалём",
    description: "Быстрый перекус — банан с миндальными орехами",
    mealType: "SNACK",
    cookTimeMin: 2,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: ["Очистить банан", "Подавать вместе с миндалём"],
    ingredients: [
      { name: "Банан", amount: 1, unit: "шт" },
      { name: "Миндаль", amount: 15, unit: "г" },
    ],
  },
  {
    name: "Яблоко с шоколадом",
    description: "Свежее яблоко с кусочками тёмного шоколада",
    mealType: "SNACK",
    cookTimeMin: 2,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: ["Нарезать яблоко дольками", "Подавать с кусочками тёмного шоколада"],
    ingredients: [
      { name: "Яблоко", amount: 1, unit: "шт" },
      { name: "Шоколад тёмный", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Смузи фруктовый",
    description: "Молочный смузи с бананом, яблоком и мёдом",
    mealType: "SNACK",
    cookTimeMin: 5,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро"],
    steps: [
      "Очистить банан, нарезать яблоко дольками",
      "Сложить фрукты, молоко и мёд в блендер",
      "Взбить до однородности",
    ],
    ingredients: [
      { name: "Банан", amount: 1, unit: "шт" },
      { name: "Яблоко", amount: 1, unit: "шт" },
      { name: "Молоко 3.2%", amount: 150, unit: "мл" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },
];

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

async function seedDishes(ingredientMap: Map<string, Ingredient>): Promise<void> {
  // Идемпотентность: каталожные блюда пересоздаются с нуля при каждом запуске.
  // DishIngredient удаляется каскадно (onDelete: Cascade в schema.prisma).
  await prisma.dish.deleteMany({ where: { source: "CATALOG" } });

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
      console.warn(
        `  [внимание] блюдо "${dish.name}": ккал (${totals.kcal.toFixed(0)}) заметно расходится с 4Б+9Ж+4У — проверьте состав`
      );
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
}

async function main() {
  console.log("Сидирую ингредиенты...");
  const ingredientMap = await seedIngredients();
  const categories = new Set(INGREDIENTS.map((i) => i.category));
  console.log(`  ${ingredientMap.size} ингредиентов, категорий покрыто: ${categories.size} / 15`);

  console.log("Сидирую каталог блюд...");
  await seedDishes(ingredientMap);
  console.log(`  ${DISHES.length} блюд создано/обновлено`);
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
