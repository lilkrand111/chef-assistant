import { Ingredient, IngredientCategory, MealType, Difficulty } from "@prisma/client";
import { prisma } from "../src/db";
import { computeDishNutrition, isKcalSane } from "../src/services/nutrition";
import { normalizeName } from "../src/services/matching";
import { embedBatch, toVectorLiteral } from "../src/services/ai/embed";

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
  { name: "Яйцо куриное", aliases: ["яйцо", "яйца", "яйца куриные"], category: "EGGS", kcal100: 157, protein100: 12.7, fat100: 10.9, carb100: 0.7, pieceMassG: 55, defaultUnit: "шт" },

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

  // === Фаза 5: расширение каталога до ~300 позиций (§5, §12) ===
  // КБЖУ выведен из тех же табличных Б/Ж/У по формуле §7.5 (kcal = 4Б + 9Ж + 4У),
  // а не переписан отдельно из пачки/этикетки — гарантирует isKcalSane = true
  // для каждого нового ингредиента и, как следствие, для любого блюда из них
  // (сумма консистентных величин консистентна) без подгонки задним числом.

  // DAIRY (+15)
  { name: "Молоко 1.5%", aliases: ["молоко маложирное"], category: "DAIRY", kcal100: 44, protein100: 2.8, fat100: 1.5, carb100: 4.7, defaultUnit: "мл" },
  { name: "Молоко 2.5%", aliases: [], category: "DAIRY", kcal100: 53, protein100: 2.8, fat100: 2.5, carb100: 4.7, defaultUnit: "мл" },
  { name: "Молоко топлёное", aliases: ["топлёное молоко"], category: "DAIRY", kcal100: 67, protein100: 3.0, fat100: 4.0, carb100: 4.7, defaultUnit: "мл" },
  { name: "Сливки 10%", aliases: ["сливки"], category: "DAIRY", kcal100: 118, protein100: 3.0, fat100: 10.0, carb100: 4.0, defaultUnit: "мл" },
  { name: "Сливки 20%", aliases: [], category: "DAIRY", kcal100: 206, protein100: 2.8, fat100: 20.0, carb100: 3.7, defaultUnit: "мл" },
  { name: "Ряженка", aliases: [], category: "DAIRY", kcal100: 51, protein100: 2.9, fat100: 2.5, carb100: 4.2, defaultUnit: "мл" },
  { name: "Простокваша", aliases: [], category: "DAIRY", kcal100: 51, protein100: 2.9, fat100: 2.5, carb100: 4.1, defaultUnit: "мл" },
  { name: "Творог 0%", aliases: ["творог обезжиренный"], category: "DAIRY", kcal100: 85, protein100: 18.0, fat100: 0.6, carb100: 1.8, defaultUnit: "г" },
  { name: "Творог 9%", aliases: [], category: "DAIRY", kcal100: 156, protein100: 16.7, fat100: 9.0, carb100: 2.0, defaultUnit: "г" },
  { name: "Сыр моцарелла", aliases: ["моцарелла"], category: "DAIRY", kcal100: 274, protein100: 18.0, fat100: 22.0, carb100: 1.0, defaultUnit: "г" },
  { name: "Сыр фета", aliases: ["фета"], category: "DAIRY", kcal100: 261, protein100: 14.0, fat100: 21.0, carb100: 4.0, defaultUnit: "г" },
  { name: "Сыр плавленый", aliases: ["плавленый сырок"], category: "DAIRY", kcal100: 217, protein100: 8.0, fat100: 19.0, carb100: 3.5, defaultUnit: "г" },
  { name: "Сыр творожный", aliases: ["сливочный сыр"], category: "DAIRY", kcal100: 256, protein100: 6.0, fat100: 24.0, carb100: 4.0, defaultUnit: "г" },
  { name: "Айран", aliases: ["тан"], category: "DAIRY", kcal100: 19, protein100: 1.0, fat100: 1.0, carb100: 1.4, defaultUnit: "мл" },
  { name: "Пахта", aliases: [], category: "DAIRY", kcal100: 37, protein100: 3.3, fat100: 0.5, carb100: 4.8, defaultUnit: "мл" },

  // MEAT_FISH (+28)
  { name: "Индейка филе", aliases: ["филе индейки"], category: "MEAT_FISH", kcal100: 86, protein100: 19.5, fat100: 0.7, carb100: 0.4, defaultUnit: "г" },
  { name: "Индейка бедро", aliases: [], category: "MEAT_FISH", kcal100: 150, protein100: 17.6, fat100: 8.8, carb100: 0, defaultUnit: "г" },
  { name: "Утка", aliases: ["утиная грудка"], category: "MEAT_FISH", kcal100: 328, protein100: 19.0, fat100: 28.0, carb100: 0, defaultUnit: "г" },
  { name: "Баранина", aliases: [], category: "MEAT_FISH", kcal100: 208, protein100: 16.0, fat100: 16.0, carb100: 0, defaultUnit: "г" },
  { name: "Телятина", aliases: [], category: "MEAT_FISH", kcal100: 90, protein100: 19.7, fat100: 1.2, carb100: 0, defaultUnit: "г" },
  { name: "Кролик", aliases: ["мясо кролика"], category: "MEAT_FISH", kcal100: 156, protein100: 21.0, fat100: 8.0, carb100: 0, defaultUnit: "г" },
  { name: "Печень куриная", aliases: ["куриная печень"], category: "MEAT_FISH", kcal100: 138, protein100: 20.4, fat100: 5.9, carb100: 0.7, defaultUnit: "г" },
  { name: "Печень говяжья", aliases: ["говяжья печень"], category: "MEAT_FISH", kcal100: 98, protein100: 17.4, fat100: 3.1, carb100: 0, defaultUnit: "г" },
  { name: "Фарш говяжий", aliases: ["говяжий фарш"], category: "MEAT_FISH", kcal100: 249, protein100: 17.2, fat100: 20.0, carb100: 0, defaultUnit: "г" },
  { name: "Фарш свиной", aliases: ["свиной фарш"], category: "MEAT_FISH", kcal100: 307, protein100: 16.0, fat100: 27.0, carb100: 0, defaultUnit: "г" },
  { name: "Фарш куриный", aliases: ["куриный фарш"], category: "MEAT_FISH", kcal100: 180, protein100: 17.4, fat100: 12.0, carb100: 0.5, defaultUnit: "г" },
  { name: "Колбаса варёная", aliases: ["варёная колбаса"], category: "MEAT_FISH", kcal100: 257, protein100: 13.0, fat100: 22.8, carb100: 0, defaultUnit: "г" },
  { name: "Сосиски", aliases: [], category: "MEAT_FISH", kcal100: 259, protein100: 12.0, fat100: 23.0, carb100: 1.0, defaultUnit: "г" },
  { name: "Бекон", aliases: [], category: "MEAT_FISH", kcal100: 421, protein100: 12.4, fat100: 41.3, carb100: 0, defaultUnit: "г" },
  { name: "Ветчина", aliases: [], category: "MEAT_FISH", kcal100: 172, protein100: 17.0, fat100: 11.5, carb100: 0, defaultUnit: "г" },
  { name: "Креветки", aliases: [], category: "MEAT_FISH", kcal100: 83, protein100: 18.0, fat100: 1.2, carb100: 0, defaultUnit: "г" },
  { name: "Кальмар", aliases: ["кальмары"], category: "MEAT_FISH", kcal100: 81, protein100: 18.0, fat100: 0.9, carb100: 0.3, defaultUnit: "г" },
  { name: "Мидии", aliases: [], category: "MEAT_FISH", kcal100: 79, protein100: 11.5, fat100: 2.0, carb100: 3.7, defaultUnit: "г" },
  { name: "Скумбрия", aliases: [], category: "MEAT_FISH", kcal100: 191, protein100: 18.0, fat100: 13.2, carb100: 0, defaultUnit: "г" },
  { name: "Сельдь", aliases: ["селёдка"], category: "MEAT_FISH", kcal100: 246, protein100: 17.7, fat100: 19.5, carb100: 0, defaultUnit: "г" },
  { name: "Минтай", aliases: ["филе минтая"], category: "MEAT_FISH", kcal100: 72, protein100: 15.9, fat100: 0.9, carb100: 0, defaultUnit: "г" },
  { name: "Тилапия", aliases: ["филе тилапии"], category: "MEAT_FISH", kcal100: 95, protein100: 20.0, fat100: 1.7, carb100: 0, defaultUnit: "г" },
  { name: "Форель", aliases: ["филе форели"], category: "MEAT_FISH", kcal100: 148, protein100: 19.0, fat100: 8.0, carb100: 0, defaultUnit: "г" },
  { name: "Хек", aliases: ["филе хека"], category: "MEAT_FISH", kcal100: 86, protein100: 16.6, fat100: 2.2, carb100: 0, defaultUnit: "г" },
  { name: "Куриные крылья", aliases: ["крылья куриные"], category: "MEAT_FISH", kcal100: 241, protein100: 17.5, fat100: 19.0, carb100: 0, defaultUnit: "г" },
  { name: "Свиная корейка", aliases: ["корейка свиная"], category: "MEAT_FISH", kcal100: 143, protein100: 20.0, fat100: 7.0, carb100: 0, defaultUnit: "г" },
  { name: "Говяжий стейк", aliases: ["стейк говяжий"], category: "MEAT_FISH", kcal100: 201, protein100: 21.0, fat100: 13.0, carb100: 0, defaultUnit: "г" },
  { name: "Судак", aliases: ["филе судака"], category: "MEAT_FISH", kcal100: 86, protein100: 19.0, fat100: 1.1, carb100: 0, defaultUnit: "г" },

  // EGGS (+3)
  { name: "Яйцо перепелиное", aliases: ["перепелиные яйца"], category: "EGGS", kcal100: 168, protein100: 11.9, fat100: 13.1, carb100: 0.6, pieceMassG: 10, defaultUnit: "шт" },
  { name: "Яичный белок", aliases: ["белок яичный"], category: "EGGS", kcal100: 49, protein100: 11.0, fat100: 0.2, carb100: 0.7, defaultUnit: "г" },
  { name: "Яичный желток", aliases: ["желток яичный"], category: "EGGS", kcal100: 350, protein100: 16.2, fat100: 31.2, carb100: 1.0, defaultUnit: "г" },

  // VEGETABLES (+32)
  { name: "Свёкла", aliases: ["свекла"], category: "VEGETABLES", kcal100: 42, protein100: 1.5, fat100: 0.1, carb100: 8.8, defaultUnit: "г" },
  { name: "Редис", aliases: [], category: "VEGETABLES", kcal100: 19, protein100: 1.2, fat100: 0.1, carb100: 3.4, defaultUnit: "г" },
  { name: "Редька", aliases: [], category: "VEGETABLES", kcal100: 36, protein100: 1.9, fat100: 0.2, carb100: 6.7, defaultUnit: "г" },
  { name: "Кабачок", aliases: ["цуккини"], category: "VEGETABLES", kcal100: 24, protein100: 0.6, fat100: 0.3, carb100: 4.6, defaultUnit: "г" },
  { name: "Баклажан", aliases: [], category: "VEGETABLES", kcal100: 24, protein100: 1.2, fat100: 0.1, carb100: 4.5, defaultUnit: "г" },
  { name: "Тыква", aliases: [], category: "VEGETABLES", kcal100: 23, protein100: 1.0, fat100: 0.1, carb100: 4.4, defaultUnit: "г" },
  { name: "Шпинат", aliases: [], category: "VEGETABLES", kcal100: 22, protein100: 2.9, fat100: 0.3, carb100: 2.0, defaultUnit: "г" },
  { name: "Салат листовой", aliases: ["салат латук", "листья салата"], category: "VEGETABLES", kcal100: 15, protein100: 1.4, fat100: 0.2, carb100: 1.8, defaultUnit: "г" },
  { name: "Сельдерей стебель", aliases: ["сельдерей"], category: "VEGETABLES", kcal100: 13, protein100: 0.9, fat100: 0.1, carb100: 2.0, defaultUnit: "г" },
  { name: "Спаржа", aliases: [], category: "VEGETABLES", kcal100: 21, protein100: 2.0, fat100: 0.1, carb100: 3.0, defaultUnit: "г" },
  { name: "Цветная капуста", aliases: [], category: "VEGETABLES", kcal100: 30, protein100: 2.5, fat100: 0.3, carb100: 4.2, defaultUnit: "г" },
  { name: "Кукуруза свежая", aliases: ["кукуруза варёная"], category: "VEGETABLES", kcal100: 84, protein100: 3.4, fat100: 1.2, carb100: 15.0, defaultUnit: "г" },
  { name: "Зелёный горошек", aliases: ["горошек свежий"], category: "VEGETABLES", kcal100: 75, protein100: 5.0, fat100: 0.2, carb100: 13.3, defaultUnit: "г" },
  { name: "Стручковая фасоль", aliases: ["фасоль спаржевая"], category: "VEGETABLES", kcal100: 25, protein100: 2.5, fat100: 0.3, carb100: 3.0, defaultUnit: "г" },
  { name: "Шампиньоны", aliases: ["грибы шампиньоны"], category: "VEGETABLES", kcal100: 31, protein100: 4.3, fat100: 1.0, carb100: 1.1, defaultUnit: "г" },
  { name: "Вешенки", aliases: ["грибы вешенки"], category: "VEGETABLES", kcal100: 22, protein100: 3.3, fat100: 0.4, carb100: 1.4, defaultUnit: "г" },
  { name: "Имбирь корень", aliases: ["имбирь"], category: "VEGETABLES", kcal100: 78, protein100: 1.8, fat100: 0.8, carb100: 15.8, defaultUnit: "г" },
  { name: "Зелёный лук", aliases: ["лук зелёный", "лук перо"], category: "VEGETABLES", kcal100: 22, protein100: 1.3, fat100: 0, carb100: 4.3, defaultUnit: "г" },
  { name: "Укроп", aliases: [], category: "VEGETABLES", kcal100: 40, protein100: 2.5, fat100: 0.5, carb100: 6.3, defaultUnit: "г" },
  { name: "Петрушка", aliases: [], category: "VEGETABLES", kcal100: 49, protein100: 3.7, fat100: 0.4, carb100: 7.6, defaultUnit: "г" },
  { name: "Кинза", aliases: ["кориандр зелень"], category: "VEGETABLES", kcal100: 28, protein100: 2.1, fat100: 0.5, carb100: 3.7, defaultUnit: "г" },
  { name: "Базилик", aliases: ["базилик свежий"], category: "VEGETABLES", kcal100: 40, protein100: 3.2, fat100: 0.6, carb100: 5.4, defaultUnit: "г" },
  { name: "Мята свежая", aliases: ["мята"], category: "VEGETABLES", kcal100: 55, protein100: 3.8, fat100: 0.7, carb100: 8.4, defaultUnit: "г" },
  { name: "Лук порей", aliases: [], category: "VEGETABLES", kcal100: 34, protein100: 2.0, fat100: 0, carb100: 6.5, defaultUnit: "г" },
  { name: "Лук красный", aliases: ["лук фиолетовый"], category: "VEGETABLES", kcal100: 43, protein100: 1.4, fat100: 0, carb100: 9.3, defaultUnit: "г" },
  { name: "Хрен корень", aliases: ["хрен"], category: "VEGETABLES", kcal100: 58, protein100: 3.2, fat100: 0.4, carb100: 10.5, defaultUnit: "г" },
  { name: "Пекинская капуста", aliases: [], category: "VEGETABLES", kcal100: 15, protein100: 1.2, fat100: 0.2, carb100: 2.0, defaultUnit: "г" },
  { name: "Брюссельская капуста", aliases: [], category: "VEGETABLES", kcal100: 38, protein100: 3.4, fat100: 0.3, carb100: 5.5, defaultUnit: "г" },
  { name: "Артишок", aliases: [], category: "VEGETABLES", kcal100: 40, protein100: 3.3, fat100: 0.2, carb100: 6.3, defaultUnit: "г" },
  { name: "Топинамбур", aliases: [], category: "VEGETABLES", kcal100: 60, protein100: 2.1, fat100: 0, carb100: 12.8, defaultUnit: "г" },
  { name: "Дайкон", aliases: [], category: "VEGETABLES", kcal100: 21, protein100: 1.2, fat100: 0, carb100: 4.1, defaultUnit: "г" },
  { name: "Фенхель", aliases: [], category: "VEGETABLES", kcal100: 36, protein100: 1.2, fat100: 0.2, carb100: 7.3, defaultUnit: "г" },

  // FRUITS (+25)
  { name: "Груша", aliases: [], category: "FRUITS", kcal100: 46, protein100: 0.4, fat100: 0.3, carb100: 10.3, pieceMassG: 170, defaultUnit: "шт" },
  { name: "Слива", aliases: [], category: "FRUITS", kcal100: 44, protein100: 0.8, fat100: 0.3, carb100: 9.6, pieceMassG: 40, defaultUnit: "шт" },
  { name: "Абрикос", aliases: [], category: "FRUITS", kcal100: 41, protein100: 0.9, fat100: 0.1, carb100: 9.0, pieceMassG: 40, defaultUnit: "шт" },
  { name: "Персик", aliases: [], category: "FRUITS", kcal100: 43, protein100: 0.9, fat100: 0.1, carb100: 9.5, pieceMassG: 150, defaultUnit: "шт" },
  { name: "Виноград", aliases: [], category: "FRUITS", kcal100: 71, protein100: 0.6, fat100: 0.2, carb100: 16.8, defaultUnit: "г" },
  { name: "Киви", aliases: [], category: "FRUITS", kcal100: 50, protein100: 1.1, fat100: 0.5, carb100: 10.3, pieceMassG: 75, defaultUnit: "шт" },
  { name: "Мандарин", aliases: [], category: "FRUITS", kcal100: 35, protein100: 0.8, fat100: 0.2, carb100: 7.5, pieceMassG: 80, defaultUnit: "шт" },
  { name: "Грейпфрут", aliases: [], category: "FRUITS", kcal100: 31, protein100: 0.7, fat100: 0.2, carb100: 6.5, pieceMassG: 200, defaultUnit: "шт" },
  { name: "Арбуз", aliases: [], category: "FRUITS", kcal100: 36, protein100: 0.6, fat100: 0.1, carb100: 8.1, defaultUnit: "г" },
  { name: "Дыня", aliases: [], category: "FRUITS", kcal100: 35, protein100: 0.6, fat100: 0.3, carb100: 7.4, defaultUnit: "г" },
  { name: "Ананас", aliases: [], category: "FRUITS", kcal100: 49, protein100: 0.4, fat100: 0.2, carb100: 11.5, defaultUnit: "г" },
  { name: "Манго", aliases: [], category: "FRUITS", kcal100: 61, protein100: 0.5, fat100: 0.3, carb100: 14.0, pieceMassG: 200, defaultUnit: "шт" },
  { name: "Гранат", aliases: [], category: "FRUITS", kcal100: 59, protein100: 0.9, fat100: 0, carb100: 13.9, pieceMassG: 250, defaultUnit: "шт" },
  { name: "Хурма", aliases: [], category: "FRUITS", kcal100: 66, protein100: 0.5, fat100: 0.3, carb100: 15.3, pieceMassG: 170, defaultUnit: "шт" },
  { name: "Черешня", aliases: [], category: "FRUITS", kcal100: 54, protein100: 1.1, fat100: 0.4, carb100: 11.5, defaultUnit: "г" },
  { name: "Клубника свежая", aliases: ["клубника"], category: "FRUITS", kcal100: 37, protein100: 0.8, fat100: 0.4, carb100: 7.5, defaultUnit: "г" },
  { name: "Малина", aliases: [], category: "FRUITS", kcal100: 41, protein100: 0.8, fat100: 0.5, carb100: 8.3, defaultUnit: "г" },
  { name: "Черника", aliases: [], category: "FRUITS", kcal100: 38, protein100: 1.1, fat100: 0.4, carb100: 7.6, defaultUnit: "г" },
  { name: "Смородина чёрная", aliases: ["чёрная смородина"], category: "FRUITS", kcal100: 37, protein100: 1.0, fat100: 0.4, carb100: 7.3, defaultUnit: "г" },
  { name: "Инжир", aliases: [], category: "FRUITS", kcal100: 59, protein100: 0.7, fat100: 0.2, carb100: 13.7, pieceMassG: 50, defaultUnit: "шт" },
  { name: "Личи", aliases: [], category: "FRUITS", kcal100: 66, protein100: 0.8, fat100: 0.3, carb100: 15.0, pieceMassG: 15, defaultUnit: "шт" },
  { name: "Помело", aliases: [], category: "FRUITS", kcal100: 41, protein100: 0.8, fat100: 0.2, carb100: 9.0, pieceMassG: 400, defaultUnit: "шт" },
  { name: "Физалис", aliases: [], category: "FRUITS", kcal100: 54, protein100: 1.0, fat100: 0.7, carb100: 11.0, defaultUnit: "г" },
  { name: "Кумкват", aliases: [], category: "FRUITS", kcal100: 53, protein100: 1.9, fat100: 0.9, carb100: 9.4, pieceMassG: 15, defaultUnit: "шт" },
  { name: "Ежевика", aliases: [], category: "FRUITS", kcal100: 27, protein100: 1.5, fat100: 0.4, carb100: 4.4, defaultUnit: "г" },

  // GRAINS_PASTA (+15)
  { name: "Пшено", aliases: ["пшённая крупа"], category: "GRAINS_PASTA", kcal100: 353, protein100: 11.5, fat100: 3.3, carb100: 69.3, defaultUnit: "г" },
  { name: "Перловка", aliases: ["перловая крупа"], category: "GRAINS_PASTA", kcal100: 342, protein100: 9.3, fat100: 1.1, carb100: 73.7, defaultUnit: "г" },
  { name: "Ячневая крупа", aliases: [], category: "GRAINS_PASTA", kcal100: 339, protein100: 10.0, fat100: 1.3, carb100: 71.7, defaultUnit: "г" },
  { name: "Манная крупа", aliases: ["манка"], category: "GRAINS_PASTA", kcal100: 343, protein100: 10.3, fat100: 1.0, carb100: 73.3, defaultUnit: "г" },
  { name: "Кускус", aliases: [], category: "GRAINS_PASTA", kcal100: 346, protein100: 12.8, fat100: 0.6, carb100: 72.4, defaultUnit: "г" },
  { name: "Рис бурый", aliases: ["рис коричневый"], category: "GRAINS_PASTA", kcal100: 337, protein100: 7.4, fat100: 1.8, carb100: 72.9, defaultUnit: "г" },
  { name: "Рис басмати", aliases: [], category: "GRAINS_PASTA", kcal100: 344, protein100: 7.5, fat100: 0.7, carb100: 77.0, defaultUnit: "г" },
  { name: "Чечевица", aliases: [], category: "GRAINS_PASTA", kcal100: 295, protein100: 24.0, fat100: 1.5, carb100: 46.3, defaultUnit: "г" },
  { name: "Горох колотый", aliases: ["горох"], category: "GRAINS_PASTA", kcal100: 300, protein100: 23.0, fat100: 1.6, carb100: 48.5, defaultUnit: "г" },
  { name: "Нут", aliases: ["турецкий горох"], category: "GRAINS_PASTA", kcal100: 315, protein100: 19.0, fat100: 6.0, carb100: 46.2, defaultUnit: "г" },
  { name: "Маш", aliases: ["бобы мунг"], category: "GRAINS_PASTA", kcal100: 298, protein100: 23.5, fat100: 2.0, carb100: 46.5, defaultUnit: "г" },
  { name: "Овсяная крупа", aliases: ["цельная овсянка"], category: "GRAINS_PASTA", kcal100: 338, protein100: 11.0, fat100: 6.2, carb100: 59.5, defaultUnit: "г" },
  { name: "Лапша яичная", aliases: ["домашняя лапша"], category: "GRAINS_PASTA", kcal100: 344, protein100: 11.0, fat100: 3.5, carb100: 67.0, defaultUnit: "г" },
  { name: "Вермишель", aliases: [], category: "GRAINS_PASTA", kcal100: 334, protein100: 10.4, fat100: 1.1, carb100: 70.5, defaultUnit: "г" },
  { name: "Мука пшеничная", aliases: ["мука"], category: "GRAINS_PASTA", kcal100: 334, protein100: 10.3, fat100: 1.1, carb100: 70.6, defaultUnit: "г" },

  // BAKERY (+12)
  { name: "Батон нарезной", aliases: ["батон"], category: "BAKERY", kcal100: 260, protein100: 7.5, fat100: 2.9, carb100: 50.9, pieceMassG: 25, defaultUnit: "шт" },
  { name: "Хлеб ржаной", aliases: [], category: "BAKERY", kcal100: 200, protein100: 6.6, fat100: 1.2, carb100: 40.7, pieceMassG: 30, defaultUnit: "шт" },
  { name: "Хлеб бородинский", aliases: [], category: "BAKERY", kcal100: 202, protein100: 6.8, fat100: 1.3, carb100: 40.7, pieceMassG: 30, defaultUnit: "шт" },
  { name: "Багет", aliases: ["французский багет"], category: "BAKERY", kcal100: 265, protein100: 8.4, fat100: 1.3, carb100: 55.0, pieceMassG: 40, defaultUnit: "шт" },
  { name: "Булочка сдобная", aliases: ["сдобная булочка"], category: "BAKERY", kcal100: 301, protein100: 7.6, fat100: 5.6, carb100: 55.0, pieceMassG: 60, defaultUnit: "шт" },
  { name: "Круассан", aliases: [], category: "BAKERY", kcal100: 396, protein100: 8.1, fat100: 20.0, carb100: 46.0, pieceMassG: 60, defaultUnit: "шт" },
  { name: "Тортилья пшеничная", aliases: ["тортилья", "лепёшка тортилья"], category: "BAKERY", kcal100: 299, protein100: 9.0, fat100: 7.0, carb100: 50.0, pieceMassG: 45, defaultUnit: "шт" },
  { name: "Панировочные сухари", aliases: ["сухари панировочные"], category: "BAKERY", kcal100: 338, protein100: 10.0, fat100: 1.4, carb100: 71.3, defaultUnit: "г" },
  { name: "Хлебцы цельнозерновые", aliases: ["хлебцы"], category: "BAKERY", kcal100: 339, protein100: 11.0, fat100: 2.5, carb100: 68.0, defaultUnit: "г" },
  { name: "Пита", aliases: ["пита хлеб"], category: "BAKERY", kcal100: 270, protein100: 9.1, fat100: 1.2, carb100: 55.6, pieceMassG: 70, defaultUnit: "шт" },
  { name: "Кекс бисквитный", aliases: ["бисквитный кекс"], category: "BAKERY", kcal100: 366, protein100: 5.0, fat100: 14.0, carb100: 55.0, defaultUnit: "г" },
  { name: "Гренки пшеничные", aliases: ["сухарики"], category: "BAKERY", kcal100: 406, protein100: 10.0, fat100: 14.0, carb100: 60.0, defaultUnit: "г" },

  // OILS_SAUCES (+11)
  { name: "Кетчуп", aliases: [], category: "OILS_SAUCES", kcal100: 98, protein100: 1.8, fat100: 0.3, carb100: 22.0, defaultUnit: "г" },
  { name: "Майонез", aliases: [], category: "OILS_SAUCES", kcal100: 619, protein100: 1.0, fat100: 67.0, carb100: 3.0, defaultUnit: "г" },
  { name: "Горчица", aliases: [], category: "OILS_SAUCES", kcal100: 112, protein100: 5.7, fat100: 6.4, carb100: 7.9, defaultUnit: "г" },
  { name: "Уксус бальзамический", aliases: ["бальзамический уксус"], category: "OILS_SAUCES", kcal100: 70, protein100: 0.5, fat100: 0, carb100: 17.0, defaultUnit: "мл" },
  { name: "Масло кунжутное", aliases: [], category: "OILS_SAUCES", kcal100: 899, protein100: 0, fat100: 99.9, carb100: 0, defaultUnit: "мл" },
  { name: "Масло льняное", aliases: [], category: "OILS_SAUCES", kcal100: 898, protein100: 0, fat100: 99.8, carb100: 0, defaultUnit: "мл" },
  { name: "Масло топлёное", aliases: ["гхи"], category: "OILS_SAUCES", kcal100: 896, protein100: 0, fat100: 99.5, carb100: 0, defaultUnit: "г" },
  { name: "Соус терияки", aliases: ["терияки"], category: "OILS_SAUCES", kcal100: 80, protein100: 5.9, fat100: 0, carb100: 14.0, defaultUnit: "мл" },
  { name: "Соус барбекю", aliases: ["барбекю соус"], category: "OILS_SAUCES", kcal100: 121, protein100: 1.0, fat100: 0.5, carb100: 28.0, defaultUnit: "мл" },
  { name: "Соус тар-тар", aliases: ["тартар соус"], category: "OILS_SAUCES", kcal100: 345, protein100: 1.5, fat100: 35.0, carb100: 6.0, defaultUnit: "г" },
  { name: "Паста томатная", aliases: ["томатная паста"], category: "OILS_SAUCES", kcal100: 100, protein100: 4.8, fat100: 0.5, carb100: 19.0, defaultUnit: "г" },

  // SPICES (+16)
  { name: "Кориандр молотый", aliases: ["кориандр"], category: "SPICES", kcal100: 430, protein100: 12.4, fat100: 17.8, carb100: 55.0, defaultUnit: "г" },
  { name: "Корица молотая", aliases: ["корица"], category: "SPICES", kcal100: 349, protein100: 4.0, fat100: 1.2, carb100: 80.6, defaultUnit: "г" },
  { name: "Зира", aliases: ["кумин"], category: "SPICES", kcal100: 449, protein100: 17.8, fat100: 22.3, carb100: 44.2, defaultUnit: "г" },
  { name: "Кардамон", aliases: [], category: "SPICES", kcal100: 378, protein100: 10.8, fat100: 6.7, carb100: 68.5, defaultUnit: "г" },
  { name: "Гвоздика", aliases: [], category: "SPICES", kcal100: 385, protein100: 6.0, fat100: 13.0, carb100: 61.0, defaultUnit: "г" },
  { name: "Мускатный орех", aliases: [], category: "SPICES", kcal100: 547, protein100: 5.8, fat100: 36.3, carb100: 49.3, defaultUnit: "г" },
  { name: "Имбирь молотый", aliases: [], category: "SPICES", kcal100: 358, protein100: 9.0, fat100: 4.2, carb100: 71.0, defaultUnit: "г" },
  { name: "Орегано", aliases: ["душица"], category: "SPICES", kcal100: 351, protein100: 9.0, fat100: 4.3, carb100: 69.0, defaultUnit: "г" },
  { name: "Тимьян", aliases: ["чабрец"], category: "SPICES", kcal100: 294, protein100: 5.6, fat100: 1.7, carb100: 64.0, defaultUnit: "г" },
  { name: "Розмарин", aliases: [], category: "SPICES", kcal100: 149, protein100: 3.3, fat100: 5.9, carb100: 20.7, defaultUnit: "г" },
  { name: "Базилик сушёный", aliases: [], category: "SPICES", kcal100: 319, protein100: 22.9, fat100: 4.0, carb100: 47.8, defaultUnit: "г" },
  { name: "Лавровый лист", aliases: ["лавровый"], category: "SPICES", kcal100: 301, protein100: 7.6, fat100: 8.4, carb100: 48.7, defaultUnit: "г" },
  { name: "Хмели-сунели", aliases: [], category: "SPICES", kcal100: 296, protein100: 8.0, fat100: 4.0, carb100: 57.0, defaultUnit: "г" },
  { name: "Приправа для плова", aliases: [], category: "SPICES", kcal100: 306, protein100: 8.0, fat100: 6.0, carb100: 55.0, defaultUnit: "г" },
  { name: "Ванилин", aliases: ["ванильный"], category: "SPICES", kcal100: 353, protein100: 0.1, fat100: 0.1, carb100: 87.9, defaultUnit: "г" },
  { name: "Смесь перцев", aliases: ["перец смесь"], category: "SPICES", kcal100: 333, protein100: 10.9, fat100: 3.3, carb100: 64.8, defaultUnit: "г" },

  // NUTS_SEEDS (+12)
  { name: "Кешью", aliases: [], category: "NUTS_SEEDS", kcal100: 601, protein100: 18.5, fat100: 48.5, carb100: 22.5, defaultUnit: "г" },
  { name: "Фундук", aliases: ["лесной орех"], category: "NUTS_SEEDS", kcal100: 651, protein100: 15.0, fat100: 61.5, carb100: 9.3, defaultUnit: "г" },
  { name: "Кедровый орех", aliases: ["кедровые орешки"], category: "NUTS_SEEDS", kcal100: 719, protein100: 13.7, fat100: 68.0, carb100: 13.1, defaultUnit: "г" },
  { name: "Фисташки", aliases: [], category: "NUTS_SEEDS", kcal100: 597, protein100: 20.2, fat100: 45.3, carb100: 27.2, defaultUnit: "г" },
  { name: "Арахис", aliases: ["арахис жареный"], category: "NUTS_SEEDS", kcal100: 552, protein100: 26.3, fat100: 45.2, carb100: 9.9, defaultUnit: "г" },
  { name: "Тыквенные семечки", aliases: [], category: "NUTS_SEEDS", kcal100: 606, protein100: 30.2, fat100: 49.1, carb100: 10.7, defaultUnit: "г" },
  { name: "Семена льна", aliases: ["льняное семя"], category: "NUTS_SEEDS", kcal100: 569, protein100: 18.3, fat100: 42.2, carb100: 28.9, defaultUnit: "г" },
  { name: "Семена чиа", aliases: ["чиа"], category: "NUTS_SEEDS", kcal100: 511, protein100: 16.5, fat100: 30.7, carb100: 42.1, defaultUnit: "г" },
  { name: "Кунжут", aliases: ["сезам"], category: "NUTS_SEEDS", kcal100: 612, protein100: 17.7, fat100: 49.7, carb100: 23.4, defaultUnit: "г" },
  { name: "Мак", aliases: ["маковое семя"], category: "NUTS_SEEDS", kcal100: 522, protein100: 17.5, fat100: 41.5, carb100: 19.5, defaultUnit: "г" },
  { name: "Кокосовая стружка", aliases: ["кокос"], category: "NUTS_SEEDS", kcal100: 640, protein100: 6.9, fat100: 57.2, carb100: 24.4, defaultUnit: "г" },
  { name: "Бразильский орех", aliases: [], category: "NUTS_SEEDS", kcal100: 704, protein100: 14.3, fat100: 66.4, carb100: 12.3, defaultUnit: "г" },

  // SWEETS (+16)
  { name: "Курага", aliases: ["сушёный абрикос"], category: "SWEETS", kcal100: 228, protein100: 5.2, fat100: 0.3, carb100: 51.0, defaultUnit: "г" },
  { name: "Чернослив", aliases: [], category: "SWEETS", kcal100: 246, protein100: 2.3, fat100: 0.7, carb100: 57.5, defaultUnit: "г" },
  { name: "Изюм", aliases: [], category: "SWEETS", kcal100: 281, protein100: 2.9, fat100: 0.6, carb100: 66.0, defaultUnit: "г" },
  { name: "Финики", aliases: ["сушёные финики"], category: "SWEETS", kcal100: 291, protein100: 2.5, fat100: 0.5, carb100: 69.2, pieceMassG: 8, defaultUnit: "шт" },
  { name: "Зефир", aliases: [], category: "SWEETS", kcal100: 319, protein100: 0.8, fat100: 0, carb100: 79.0, defaultUnit: "г" },
  { name: "Пастила", aliases: [], category: "SWEETS", kcal100: 324, protein100: 0.5, fat100: 0.2, carb100: 80.0, defaultUnit: "г" },
  { name: "Мармелад", aliases: [], category: "SWEETS", kcal100: 313, protein100: 0.4, fat100: 0.1, carb100: 77.7, defaultUnit: "г" },
  { name: "Печенье овсяное", aliases: ["овсяное печенье"], category: "SWEETS", kcal100: 424, protein100: 6.5, fat100: 14.0, carb100: 68.0, defaultUnit: "г" },
  { name: "Печенье сахарное", aliases: [], category: "SWEETS", kcal100: 434, protein100: 7.5, fat100: 11.8, carb100: 74.4, defaultUnit: "г" },
  { name: "Вафли", aliases: [], category: "SWEETS", kcal100: 358, protein100: 3.2, fat100: 2.8, carb100: 80.1, defaultUnit: "г" },
  { name: "Пряники", aliases: [], category: "SWEETS", kcal100: 355, protein100: 4.8, fat100: 2.8, carb100: 77.7, defaultUnit: "г" },
  { name: "Шоколад молочный", aliases: ["молочный шоколад"], category: "SWEETS", kcal100: 567, protein100: 6.9, fat100: 35.7, carb100: 54.4, defaultUnit: "г" },
  { name: "Варенье клубничное", aliases: ["клубничное варенье"], category: "SWEETS", kcal100: 243, protein100: 0.3, fat100: 0.2, carb100: 60.0, defaultUnit: "г" },
  { name: "Джем", aliases: [], category: "SWEETS", kcal100: 227, protein100: 0.4, fat100: 0.1, carb100: 56.0, defaultUnit: "г" },
  { name: "Халва", aliases: [], category: "SWEETS", kcal100: 530, protein100: 11.6, fat100: 29.7, carb100: 54.0, defaultUnit: "г" },
  { name: "Сгущённое молоко", aliases: ["сгущёнка"], category: "SWEETS", kcal100: 329, protein100: 7.2, fat100: 8.5, carb100: 56.0, defaultUnit: "г" },

  // BEVERAGES (+17)
  { name: "Кофе чёрный", aliases: ["кофе"], category: "BEVERAGES", kcal100: 2, protein100: 0.2, fat100: 0, carb100: 0.3, defaultUnit: "мл" },
  { name: "Компот", aliases: [], category: "BEVERAGES", kcal100: 40, protein100: 0.1, fat100: 0, carb100: 10.0, defaultUnit: "мл" },
  { name: "Морс клюквенный", aliases: ["клюквенный морс"], category: "BEVERAGES", kcal100: 44, protein100: 0.1, fat100: 0, carb100: 11.0, defaultUnit: "мл" },
  { name: "Сок яблочный", aliases: ["яблочный сок"], category: "BEVERAGES", kcal100: 42, protein100: 0.4, fat100: 0.1, carb100: 9.8, defaultUnit: "мл" },
  { name: "Сок томатный", aliases: ["томатный сок"], category: "BEVERAGES", kcal100: 21, protein100: 1.0, fat100: 0.1, carb100: 4.0, defaultUnit: "мл" },
  { name: "Сок виноградный", aliases: ["виноградный сок"], category: "BEVERAGES", kcal100: 57, protein100: 0.3, fat100: 0, carb100: 14.0, defaultUnit: "мл" },
  { name: "Квас", aliases: [], category: "BEVERAGES", kcal100: 22, protein100: 0.2, fat100: 0, carb100: 5.2, defaultUnit: "мл" },
  { name: "Молочный коктейль", aliases: [], category: "BEVERAGES", kcal100: 92, protein100: 3.2, fat100: 3.5, carb100: 12.0, defaultUnit: "мл" },
  { name: "Вода газированная", aliases: ["газировка"], category: "BEVERAGES", kcal100: 0, protein100: 0, fat100: 0, carb100: 0, defaultUnit: "мл" },
  { name: "Лимонад", aliases: [], category: "BEVERAGES", kcal100: 42, protein100: 0, fat100: 0, carb100: 10.5, defaultUnit: "мл" },
  { name: "Энергетический напиток", aliases: ["энергетик"], category: "BEVERAGES", kcal100: 44, protein100: 0, fat100: 0, carb100: 11.0, defaultUnit: "мл" },
  { name: "Кофе с молоком", aliases: ["латте", "капучино"], category: "BEVERAGES", kcal100: 15, protein100: 0.7, fat100: 0.8, carb100: 1.3, defaultUnit: "мл" },
  { name: "Какао порошок", aliases: ["какао"], category: "BEVERAGES", kcal100: 388, protein100: 24.2, fat100: 17.5, carb100: 33.4, defaultUnit: "г" },
  { name: "Чай зелёный", aliases: [], category: "BEVERAGES", kcal100: 1, protein100: 0, fat100: 0, carb100: 0.3, defaultUnit: "г" },
  { name: "Чай травяной", aliases: [], category: "BEVERAGES", kcal100: 1, protein100: 0, fat100: 0, carb100: 0.2, defaultUnit: "г" },
  { name: "Сок мультифрукт", aliases: ["мультифруктовый сок"], category: "BEVERAGES", kcal100: 45, protein100: 0.3, fat100: 0, carb100: 11.0, defaultUnit: "мл" },
  { name: "Изотоник спортивный", aliases: ["изотоник"], category: "BEVERAGES", kcal100: 24, protein100: 0, fat100: 0, carb100: 6.0, defaultUnit: "мл" },

  // FROZEN (+13)
  { name: "Пельмени замороженные", aliases: ["пельмени"], category: "FROZEN", kcal100: 258, protein100: 11.3, fat100: 13.0, carb100: 24.0, defaultUnit: "г" },
  { name: "Вареники с картофелем", aliases: ["вареники"], category: "FROZEN", kcal100: 141, protein100: 6.5, fat100: 3.0, carb100: 22.0, defaultUnit: "г" },
  { name: "Блинчики с мясом замороженные", aliases: ["блинчики с мясом"], category: "FROZEN", kcal100: 214, protein100: 9.0, fat100: 10.0, carb100: 22.0, defaultUnit: "г" },
  { name: "Котлеты куриные замороженные", aliases: ["куриные котлеты замороженные"], category: "FROZEN", kcal100: 196, protein100: 14.0, fat100: 12.0, carb100: 8.0, defaultUnit: "г" },
  { name: "Наггетсы куриные", aliases: ["наггетсы"], category: "FROZEN", kcal100: 273, protein100: 15.0, fat100: 17.0, carb100: 15.0, defaultUnit: "г" },
  { name: "Рыбные палочки", aliases: [], category: "FROZEN", kcal100: 206, protein100: 12.0, fat100: 10.0, carb100: 17.0, defaultUnit: "г" },
  { name: "Картофель фри замороженный", aliases: ["картофель фри"], category: "FROZEN", kcal100: 175, protein100: 3.4, fat100: 5.0, carb100: 29.0, defaultUnit: "г" },
  { name: "Овощи гриль замороженные", aliases: ["овощная смесь гриль"], category: "FROZEN", kcal100: 37, protein100: 1.5, fat100: 0.3, carb100: 7.0, defaultUnit: "г" },
  { name: "Мороженое пломбир", aliases: ["пломбир"], category: "FROZEN", kcal100: 237, protein100: 3.5, fat100: 15.0, carb100: 22.0, defaultUnit: "г" },
  { name: "Мороженое фруктовый лёд", aliases: ["фруктовый лёд"], category: "FROZEN", kcal100: 100, protein100: 0.1, fat100: 0, carb100: 25.0, defaultUnit: "г" },
  { name: "Малина замороженная", aliases: [], category: "FROZEN", kcal100: 34, protein100: 0.8, fat100: 0.3, carb100: 7.0, defaultUnit: "г" },
  { name: "Вишня замороженная", aliases: [], category: "FROZEN", kcal100: 45, protein100: 0.8, fat100: 0.2, carb100: 10.0, defaultUnit: "г" },
  { name: "Смородина замороженная", aliases: [], category: "FROZEN", kcal100: 34, protein100: 1.0, fat100: 0.2, carb100: 7.0, defaultUnit: "г" },

  // CANNED (+12)
  { name: "Горошек консервированный", aliases: ["зелёный горошек консервированный"], category: "CANNED", kcal100: 61, protein100: 5.0, fat100: 0.2, carb100: 9.9, defaultUnit: "г" },
  { name: "Огурцы маринованные", aliases: ["огурцы консервированные"], category: "CANNED", kcal100: 12, protein100: 1.3, fat100: 0.1, carb100: 1.5, defaultUnit: "г" },
  { name: "Оливки консервированные", aliases: ["оливки"], category: "CANNED", kcal100: 142, protein100: 1.0, fat100: 14.0, carb100: 3.0, defaultUnit: "г" },
  { name: "Маслины", aliases: [], category: "CANNED", kcal100: 177, protein100: 2.2, fat100: 16.0, carb100: 6.0, defaultUnit: "г" },
  { name: "Томаты в собственном соку", aliases: ["помидоры консервированные"], category: "CANNED", kcal100: 22, protein100: 1.1, fat100: 0.2, carb100: 4.0, defaultUnit: "г" },
  { name: "Лосось консервированный", aliases: [], category: "CANNED", kcal100: 138, protein100: 20.9, fat100: 6.0, carb100: 0, defaultUnit: "г" },
  { name: "Сайра консервированная", aliases: [], category: "CANNED", kcal100: 279, protein100: 18.0, fat100: 23.0, carb100: 0, defaultUnit: "г" },
  { name: "Печень трески консервированная", aliases: ["печень трески"], category: "CANNED", kcal100: 613, protein100: 4.2, fat100: 65.7, carb100: 1.2, defaultUnit: "г" },
  { name: "Шпроты", aliases: ["шпроты в масле"], category: "CANNED", kcal100: 363, protein100: 17.4, fat100: 32.4, carb100: 0.4, defaultUnit: "г" },
  { name: "Ананас консервированный", aliases: [], category: "CANNED", kcal100: 67, protein100: 0.3, fat100: 0, carb100: 16.5, defaultUnit: "г" },
  { name: "Персики консервированные", aliases: [], category: "CANNED", kcal100: 54, protein100: 0.5, fat100: 0, carb100: 13.0, defaultUnit: "г" },
  { name: "Икра кабачковая", aliases: ["кабачковая икра"], category: "CANNED", kcal100: 86, protein100: 1.5, fat100: 6.0, carb100: 6.5, defaultUnit: "г" },

  // OTHER (+8)
  { name: "Крахмал картофельный", aliases: ["крахмал"], category: "OTHER", kcal100: 316, protein100: 0.1, fat100: 0, carb100: 79.0, defaultUnit: "г" },
  { name: "Крахмал кукурузный", aliases: [], category: "OTHER", kcal100: 342, protein100: 0.6, fat100: 0, carb100: 85.0, defaultUnit: "г" },
  { name: "Желатин", aliases: [], category: "OTHER", kcal100: 355, protein100: 87.2, fat100: 0.4, carb100: 0.7, defaultUnit: "г" },
  { name: "Агар-агар", aliases: [], category: "OTHER", kcal100: 48, protein100: 2.0, fat100: 0, carb100: 10.0, defaultUnit: "г" },
  { name: "Ванильный сахар", aliases: [], category: "OTHER", kcal100: 396, protein100: 0, fat100: 0, carb100: 99.0, defaultUnit: "г" },
  { name: "Пищевая сода", aliases: ["сода пищевая"], category: "OTHER", kcal100: 0, protein100: 0, fat100: 0, carb100: 0, defaultUnit: "г" },
  { name: "Кокосовое молоко", aliases: [], category: "OTHER", kcal100: 236, protein100: 2.3, fat100: 24.0, carb100: 2.6, defaultUnit: "мл" },
  { name: "Тофу", aliases: ["соевый творог"], category: "OTHER", kcal100: 72, protein100: 8.0, fat100: 4.2, carb100: 0.6, defaultUnit: "г" },
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
      "Молоко влить в кастрюлю и довести до кипения на среднем огне, помешивая, чтобы не пригорело.",
      "Убавить огонь до слабого, всыпать овсяные хлопья и варить 5 минут, часто помешивая, пока каша не загустеет.",
      "Банан очистить и нарезать кружочками толщиной около 5 мм.",
      "Снять кашу с огня, разложить по тарелке, сверху выложить банан и полить мёдом. Подавать горячей.",
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
      "Помидор нарезать дольками толщиной около 1 см.",
      "Разогреть сковороду на среднем огне, растопить сливочное масло.",
      "Выложить помидор на сковороду и обжарить 2-3 минуты, пока дольки не станут мягкими по краям.",
      "Аккуратно разбить яйца поверх помидоров, стараясь не повредить желтки, посолить.",
      "Убавить огонь до слабого, накрыть крышкой и жарить 4-5 минут, пока белок полностью не побелеет, а желток останется жидким (или дольше, если нужен твёрдый желток).",
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
      "Клубнику разморозить при комнатной температуре 10-15 минут или в микроволновке 30-40 секунд на минимальной мощности.",
      "Выложить творог в глубокую тарелку или пиалу.",
      "Сверху выложить размороженную клубнику и полить мёдом. Подавать сразу.",
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
      "Ломтики хлеба обжарить в тостере или на сухой сковороде на среднем огне 2-3 минуты с каждой стороны до золотистой корочки.",
      "Авокадо разрезать пополам, вынуть мякоть половины ложкой и размять вилкой до состояния грубого пюре.",
      "Сбрызнуть авокадо соком, выжатым из дольки лимона, посолить и перемешать.",
      "Намазать авокадо толстым слоем на тосты. Подавать сразу, пока тосты тёплые.",
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
      "Куриное бедро залить 1-1.2 л холодной воды, довести до кипения на сильном огне и снять пену шумовкой.",
      "Убавить огонь до слабого, накрыть крышкой и варить 25-30 минут до мягкости мяса. Мясо вынуть, бульон процедить через сито и вернуть в кастрюлю.",
      "Пока варится бедро, картофель и морковь нарезать кубиками, лук мелко нарубить.",
      "В процеженный бульон выложить картофель, морковь и лук, довести до кипения на среднем огне и варить 15 минут до мягкости овощей.",
      "Курицу отделить от кости, нарезать кусочками и вернуть в суп. Посолить, довести до кипения и снять с огня.",
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
      "Говядину нарезать кубиками около 2 см.",
      "Разогреть сковороду на среднем огне, влить масло и обжарить говядину 5-7 минут до румяной корочки со всех сторон.",
      "Лук мелко нарезать, добавить к мясу и обжарить вместе 3-4 минуты, помешивая, пока лук не станет мягким.",
      "Влить 100-150 мл воды, посолить, убавить огонь до слабого, накрыть крышкой и тушить 20 минут до мягкости мяса.",
      "Пока тушится мясо, отдельно отварить гречку в подсоленной воде 15 минут до готовности. Подавать гречку с мясом и подливой.",
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
      "Отварить макароны в большом количестве подсоленной кипящей воды согласно времени на упаковке (обычно 8-10 минут), до состояния al dente.",
      "Пока варятся макароны, помидор нарезать небольшими кубиками.",
      "Слить жидкость с тунца и размять его вилкой на крупные хлопья.",
      "Готовые макароны откинуть на дуршлаг, дать стечь воде.",
      "Смешать макароны, тунца и помидор в тёплой кастрюле, заправить оливковым маслом и перемешать. Подавать сразу.",
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
      "Куриное филе нарезать кубиками 2-3 см. Разогреть в казане или глубокой сковороде масло на среднем огне и обжарить курицу 5-7 минут до лёгкой золотистой корочки.",
      "Морковь нарезать соломкой, лук — полукольцами. Добавить к курице и жарить вместе 5 минут, помешивая, пока лук не станет мягким и прозрачным.",
      "Рис промыть в холодной воде 3-4 раза до прозрачной воды, всыпать поверх курицы с овощами и разровнять, не перемешивая.",
      "Залить кипятком так, чтобы вода покрывала рис на 1.5-2 см, посолить. Довести до кипения на сильном огне.",
      "Убавить огонь до минимального, накрыть крышкой и томить 25-30 минут, не поднимая крышку, пока рис не впитает всю воду и не станет мягким.",
      "Снять с огня и дать плову настояться под крышкой ещё 10 минут, затем перемешать и подавать.",
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
      "Разогреть духовку до 200°C. Застелить противень пергаментом.",
      "Брокколи разобрать на некрупные соцветия.",
      "Выложить филе лосося и брокколи на противень в один слой.",
      "Сбрызнуть оливковым маслом и соком, выжатым из лимона, посолить и поперчить.",
      "Запекать 15-18 минут, пока лосось не станет непрозрачным и легко не разделится вилкой, а брокколи не станет мягкой с лёгкой румяностью по краям.",
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
      "Свинину нарезать кубиками около 2 см.",
      "Разогреть сковороду или казан на среднем огне, влить масло и обжарить свинину 5-7 минут до румяной корочки.",
      "Лук и морковь нарезать некрупно, добавить к мясу и обжарить вместе 5 минут, помешивая.",
      "Капусту нашинковать тонкой соломкой, добавить к мясу с овощами и перемешать.",
      "Влить 100 мл воды, посолить, убавить огонь до слабого, накрыть крышкой и тушить 30-35 минут, изредка помешивая, пока капуста не станет мягкой.",
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
      "Картофель очистить, нарезать крупными кусками и залить холодной подсоленной водой.",
      "Довести до кипения на сильном огне, убавить огонь до среднего и варить 20-25 минут до мягкости (картофель должен легко протыкаться ножом).",
      "Пока варится картофель, филе трески посолить и отварить на пару или в кипящей воде 10-12 минут до готовности (мясо должно легко разделяться на волокна).",
      "Слить с картофеля воду, добавить горячее молоко и сливочное масло, растолочь толкушкой до однородного пюре без комков.",
      "Подавать пюре с треской, полив небольшим количеством масла сверху.",
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
      "Яйца залить холодной водой, довести до кипения и варить 8-9 минут для полностью сваренного желтка. Слить кипяток, залить холодной водой и остудить, затем очистить и нарезать кубиками.",
      "Огурец и помидор нарезать кубиками того же размера, что и яйцо.",
      "Слить жидкость с тунца и размять его вилкой на крупные хлопья.",
      "Смешать яйца, огурец, помидор и тунца в глубокой миске, посолить по вкусу.",
      "Заправить оливковым маслом и аккуратно перемешать. Подавать сразу.",
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
      "Грецкие орехи крупно порубить ножом или раздавить плоской стороной ножа — до кусочков 3-5 мм, не в крошку.",
      "Выложить йогурт в глубокую пиалу или стакан.",
      "Посыпать йогурт орехами и полить мёдом сверху. Подавать сразу, пока орехи хрустящие.",
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
    steps: [
      "Банан очистить от кожуры и, при желании, нарезать кружочками толщиной около 1 см.",
      "Выложить банан на тарелку рядом с миндалём. Подавать сразу.",
    ],
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
    steps: [
      "Яблоко вымыть, разрезать на 6-8 долек, удалив сердцевину.",
      "Шоколад разломать или нарезать на небольшие кусочки.",
      "Выложить дольки яблока на тарелку вперемешку с кусочками шоколада. Подавать сразу, чтобы яблоко не потемнело.",
    ],
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
      "Банан очистить, яблоко вымыть, удалить сердцевину и нарезать дольками.",
      "Сложить банан, яблоко, молоко и мёд в чашу блендера.",
      "Взбить 30-40 секунд до однородной консистенции без крупных кусочков. Подавать сразу.",
    ],
    ingredients: [
      { name: "Банан", amount: 1, unit: "шт" },
      { name: "Яблоко", amount: 1, unit: "шт" },
      { name: "Молоко 3.2%", amount: 150, unit: "мл" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },

  // === Фаза 5: расширение каталога до ~80 блюд (§5, §12) ===
  // По 16 новых блюд на каждый MealType (4+16=20), с разбросом лёгкое/среднее/
  // сытное — плотности достаточно для оптимизатора меню (§7.3) на разных целях.

  // --- BREAKFAST (+16) ---
  {
    name: "Омлет с сыром",
    description: "Пышный омлет с молоком и тёртым сыром",
    mealType: "BREAKFAST",
    cookTimeMin: 10,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро"],
    steps: [
      "Яйца разбить в миску, добавить молоко и соль, взбить вилкой или венчиком до однородности.",
      "Сыр натереть на крупной тёрке.",
      "Разогреть сковороду на среднем огне, растопить сливочное масло.",
      "Вылить яичную смесь на сковороду, посыпать половиной сыра.",
      "Убавить огонь до слабого, накрыть крышкой и готовить 5-6 минут, пока омлет не схватится по краям и не поднимется. Посыпать оставшимся сыром перед подачей.",
    ],
    ingredients: [
      { name: "Яйцо куриное", amount: 3, unit: "шт" },
      { name: "Молоко 3.2%", amount: 30, unit: "мл" },
      { name: "Сыр твёрдый", amount: 30, unit: "г" },
      { name: "Масло сливочное", amount: 10, unit: "г" },
      { name: "Соль", amount: 1, unit: "г" },
    ],
  },
  {
    name: "Гречневая каша на молоке",
    description: "Классическая гречка на молоке с сахаром и маслом",
    mealType: "BREAKFAST",
    cookTimeMin: 20,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское"],
    steps: [
      "Гречку промыть в холодной воде до прозрачной воды.",
      "Переложить гречку в кастрюлю, залить молоком и довести до кипения на среднем огне.",
      "Убавить огонь до слабого, накрыть крышкой и варить 15 минут, изредка помешивая, пока крупа не станет мягкой и не впитает молоко.",
      "Снять с огня, добавить сахар и сливочное масло, перемешать и дать постоять под крышкой 2-3 минуты.",
    ],
    ingredients: [
      { name: "Гречка", amount: 60, unit: "г" },
      { name: "Молоко 3.2%", amount: 200, unit: "мл" },
      { name: "Сахар", amount: 10, unit: "г" },
      { name: "Масло сливочное", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Сырники",
    description: "Домашние сырники из творога, обжаренные до золотистой корочки",
    mealType: "BREAKFAST",
    cookTimeMin: 20,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["вегетарианское"],
    steps: [
      "Творог размять вилкой, добавить яйцо, сахар и половину муки, перемешать до однородного теста.",
      "Разделить тесто на 6-8 равных частей, сформировать сырники толщиной около 1.5 см и обвалять в оставшейся муке.",
      "Разогреть сковороду на среднем огне, разогреть масло.",
      "Обжарить сырники по 2-3 минуты с каждой стороны до румяной золотистой корочки, затем убавить огонь и довести до готовности ещё 2 минуты под крышкой.",
    ],
    ingredients: [
      { name: "Творог 9%", amount: 200, unit: "г" },
      { name: "Яйцо куриное", amount: 1, unit: "шт" },
      { name: "Мука пшеничная", amount: 30, unit: "г" },
      { name: "Сахар", amount: 15, unit: "г" },
      { name: "Масло подсолнечное", amount: 15, unit: "мл" },
    ],
  },
  {
    name: "Мюсли с йогуртом",
    description: "Овсяные хлопья с йогуртом, мёдом, орехами и клубникой",
    mealType: "BREAKFAST",
    cookTimeMin: 5,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро", "лёгкое"],
    steps: [
      "Клубнику вымыть и нарезать дольками.",
      "Грецкий орех крупно порубить ножом.",
      "Выложить овсяные хлопья в глубокую тарелку, залить йогуртом и перемешать.",
      "Сверху выложить клубнику и орехи, полить мёдом. Подавать сразу, чтобы хлопья остались хрустящими.",
    ],
    ingredients: [
      { name: "Овсяные хлопья", amount: 40, unit: "г" },
      { name: "Йогурт натуральный", amount: 150, unit: "г" },
      { name: "Мёд", amount: 10, unit: "г" },
      { name: "Грецкий орех", amount: 15, unit: "г" },
      { name: "Клубника свежая", amount: 50, unit: "г" },
    ],
  },
  {
    name: "Блинчики",
    description: "Тонкие блинчики на молоке",
    mealType: "BREAKFAST",
    cookTimeMin: 25,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["вегетарианское"],
    steps: [
      "В миске взбить яйцо с сахаром, влить половину молока и перемешать.",
      "Всыпать муку небольшими порциями, каждый раз размешивая венчиком, чтобы не было комков.",
      "Влить оставшееся молоко тонкой струйкой, довести тесто до консистенции жидкой сметаны.",
      "Разогреть сковороду на среднем огне, смазать тонким слоем масла.",
      "Вылить половник теста на сковороду, распределить тонким слоем и жарить 1-2 минуты до золотистого цвета, затем перевернуть и жарить ещё 1 минуту. Повторить с оставшимся тестом.",
    ],
    ingredients: [
      { name: "Мука пшеничная", amount: 100, unit: "г" },
      { name: "Молоко 3.2%", amount: 200, unit: "мл" },
      { name: "Яйцо куриное", amount: 1, unit: "шт" },
      { name: "Сахар", amount: 10, unit: "г" },
      { name: "Масло подсолнечное", amount: 10, unit: "мл" },
    ],
  },
  {
    name: "Творожная запеканка",
    description: "Нежная запеканка из творога с манкой и изюмом",
    mealType: "BREAKFAST",
    cookTimeMin: 40,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["вегетарианское", "сытно"],
    steps: [
      "Разогреть духовку до 180°C.",
      "Творог размять вилкой, добавить яйца, манную крупу и сахар, перемешать до однородности.",
      "Изюм промыть, обсушить и добавить в тесто, перемешать.",
      "Выложить тесто в смазанную маслом форму для запекания и разровнять поверхность.",
      "Запекать 25-30 минут до румяной золотистой корочки, пока середина не станет упругой на ощупь. Дать остыть 5-10 минут перед подачей.",
    ],
    ingredients: [
      { name: "Творог 5%", amount: 250, unit: "г" },
      { name: "Яйцо куриное", amount: 2, unit: "шт" },
      { name: "Манная крупа", amount: 30, unit: "г" },
      { name: "Сахар", amount: 20, unit: "г" },
      { name: "Изюм", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Тост с яйцом пашот и авокадо",
    description: "Хлебный тост с авокадо и яйцом пашот",
    mealType: "BREAKFAST",
    cookTimeMin: 15,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["вегетарианское"],
    steps: [
      "В небольшой кастрюле довести воду до слабого кипения (мелкие пузырьки, без бурления).",
      "Разбить яйцо в чашку, аккуратно создать воронку в воде ложкой и вылить яйцо в центр. Варить 3 минуты, пока белок не схватится, а желток останется жидким.",
      "Шумовкой вынуть яйцо и переложить на бумажное полотенце, чтобы убрать лишнюю воду. Повторить со вторым яйцом.",
      "Пока варится яйцо, подсушить ломтики хлеба в тостере до золотистой корочки.",
      "Размять мякоть авокадо вилкой, посолить, намазать на тосты.",
      "Выложить яйцо пашот сверху на тосты. Подавать сразу, пока желток тёплый.",
    ],
    ingredients: [
      { name: "Хлеб пшеничный", amount: 2, unit: "шт" },
      { name: "Яйцо куриное", amount: 2, unit: "шт" },
      { name: "Авокадо", amount: 0.5, unit: "шт" },
      { name: "Соль", amount: 1, unit: "г" },
    ],
  },
  {
    name: "Каша пшённая с тыквой",
    description: "Пшённая каша на молоке с кусочками тыквы и мёдом",
    mealType: "BREAKFAST",
    cookTimeMin: 30,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское"],
    steps: [
      "Тыкву очистить от кожуры и семян, нарезать кубиками около 1 см.",
      "Пшено промыть в нескольких водах до прозрачной воды.",
      "В кастрюлю выложить пшено и тыкву, залить молоком, довести до кипения на среднем огне.",
      "Убавить огонь до слабого, накрыть крышкой и варить 20 минут, изредка помешивая, пока тыква не станет мягкой, а каша не загустеет.",
      "Снять с огня, добавить мёд и перемешать перед подачей.",
    ],
    ingredients: [
      { name: "Пшено", amount: 60, unit: "г" },
      { name: "Тыква", amount: 100, unit: "г" },
      { name: "Молоко 3.2%", amount: 150, unit: "мл" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Сэндвич с ветчиной и сыром",
    description: "Классический сэндвич с ветчиной, сыром и сливочным маслом",
    mealType: "BREAKFAST",
    cookTimeMin: 5,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["быстро"],
    steps: [
      "Ломтики хлеба слегка обжарить в тостере или оставить свежими — по желанию.",
      "Один ломтик хлеба намазать сливочным маслом тонким слоем.",
      "Сыр нарезать тонкими пластинами, ветчину выложить ровным слоем поверх масла, сверху — сыр.",
      "Накрыть вторым ломтиком хлеба, слегка прижать и разрезать по диагонали. Подавать сразу.",
    ],
    ingredients: [
      { name: "Хлеб пшеничный", amount: 2, unit: "шт" },
      { name: "Ветчина", amount: 50, unit: "г" },
      { name: "Сыр твёрдый", amount: 30, unit: "г" },
      { name: "Масло сливочное", amount: 5, unit: "г" },
    ],
  },
  {
    name: "Фруктовый салат с йогуртом",
    description: "Лёгкий салат из яблока, банана и апельсина с йогуртовой заправкой",
    mealType: "BREAKFAST",
    cookTimeMin: 10,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: [
      "Яблоко вымыть, удалить сердцевину и нарезать кубиками около 1.5 см.",
      "Банан очистить и нарезать кружочками, апельсин очистить от кожуры и плёнок, разделить на дольки и нарезать кусочками.",
      "Сложить все фрукты в глубокую тарелку и аккуратно перемешать.",
      "Заправить йогуртом непосредственно перед подачей, чтобы фрукты не пустили сок.",
    ],
    ingredients: [
      { name: "Яблоко", amount: 1, unit: "шт" },
      { name: "Банан", amount: 1, unit: "шт" },
      { name: "Апельсин", amount: 1, unit: "шт" },
      { name: "Йогурт натуральный", amount: 100, unit: "г" },
    ],
  },
  {
    name: "Овсяноблин с творогом",
    description: "Овсяноблин из хлопьев и яиц с творожной начинкой",
    mealType: "BREAKFAST",
    cookTimeMin: 15,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["вегетарианское"],
    steps: [
      "Взбить яйца с молоком и солью, добавить овсяные хлопья и перемешать до однородной жидкой массы. Дать постоять 5 минут, чтобы хлопья набухли.",
      "Разогреть сковороду на среднем огне, вылить тесто тонким слоем и жарить 2-3 минуты, пока края не подрумянятся.",
      "Перевернуть блин и жарить ещё 2 минуты, пока не пропечётся полностью.",
      "Выложить творог на половину блина, свернуть пополам и слегка прогреть по 30 секунд с каждой стороны.",
    ],
    ingredients: [
      { name: "Овсяные хлопья", amount: 40, unit: "г" },
      { name: "Яйцо куриное", amount: 2, unit: "шт" },
      { name: "Молоко 3.2%", amount: 30, unit: "мл" },
      { name: "Соль", amount: 1, unit: "г" },
      { name: "Творог 5%", amount: 50, unit: "г" },
    ],
  },
  {
    name: "Каша рисовая молочная",
    description: "Сытная рисовая каша на молоке с маслом и сахаром",
    mealType: "BREAKFAST",
    cookTimeMin: 30,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "сытно"],
    steps: [
      "Рис промыть в холодной воде до прозрачной воды.",
      "Переложить рис в кастрюлю, залить молоком и довести до кипения на среднем огне, помешивая, чтобы молоко не убежало.",
      "Убавить огонь до слабого, накрыть крышкой и варить 20 минут, периодически помешивая, пока рис не станет мягким, а каша не загустеет.",
      "Снять с огня, добавить сахар и сливочное масло, перемешать и дать постоять под крышкой 3-5 минут перед подачей.",
    ],
    ingredients: [
      { name: "Рис длиннозёрный", amount: 60, unit: "г" },
      { name: "Молоко 3.2%", amount: 250, unit: "мл" },
      { name: "Сахар", amount: 15, unit: "г" },
      { name: "Масло сливочное", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Яйца с беконом и тостами",
    description: "Жареные яйца с хрустящим беконом и цельнозерновыми тостами",
    mealType: "BREAKFAST",
    cookTimeMin: 15,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Разогреть сухую сковороду на среднем огне и обжарить бекон 3-4 минуты с каждой стороны до хрустящей корочки. Переложить на бумажное полотенце.",
      "На той же сковороде, на выделившемся жире, разбить яйца и жарить на слабом огне 3-4 минуты, пока белок не побелеет, а желток останется мягким.",
      "Пока жарятся яйца, подсушить хлеб в тостере до золотистой корочки и смазать сливочным маслом.",
      "Выложить яйца и бекон рядом с тостами. Подавать горячим.",
    ],
    ingredients: [
      { name: "Яйцо куриное", amount: 2, unit: "шт" },
      { name: "Хлеб цельнозерновой", amount: 2, unit: "шт" },
      { name: "Бекон", amount: 30, unit: "г" },
      { name: "Масло сливочное", amount: 5, unit: "г" },
    ],
  },
  {
    name: "Смузи-боул с ягодами",
    description: "Густой смузи из банана, клубники и йогурта с семенами чиа",
    mealType: "BREAKFAST",
    cookTimeMin: 10,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое"],
    steps: [
      "Клубнику разморозить на столе 5-10 минут, банан очистить и нарезать крупными кусочками.",
      "Сложить банан, клубнику и йогурт в чашу блендера и взбить до густой однородной массы без комков.",
      "Перелить смузи в глубокую тарелку и слегка разровнять поверхность ложкой.",
      "Посыпать семенами чиа. Подавать сразу, пока смузи холодный.",
    ],
    ingredients: [
      { name: "Банан", amount: 1, unit: "шт" },
      { name: "Клубника замороженная", amount: 100, unit: "г" },
      { name: "Йогурт натуральный", amount: 150, unit: "г" },
      { name: "Семена чиа", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Гречневые оладьи",
    description: "Оладьи из гречки и кефира на завтрак",
    mealType: "BREAKFAST",
    cookTimeMin: 25,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["вегетарианское"],
    steps: [
      "Гречку отварить в подсоленной воде 15 минут до мягкости, слить воду и остудить 5-7 минут.",
      "В миске смешать отваренную гречку, яйцо, кефир и муку до однородного густого теста.",
      "Разогреть сковороду на среднем огне, слегка смазать маслом.",
      "Выкладывать тесто столовой ложкой и жарить оладьи по 2 минуты с каждой стороны до румяной корочки.",
    ],
    ingredients: [
      { name: "Гречка", amount: 60, unit: "г" },
      { name: "Яйцо куриное", amount: 1, unit: "шт" },
      { name: "Кефир 1%", amount: 100, unit: "мл" },
      { name: "Мука пшеничная", amount: 30, unit: "г" },
    ],
  },
  {
    name: "Творог с бананом",
    description: "Лёгкий завтрак — обезжиренный творог с бананом и мёдом",
    mealType: "BREAKFAST",
    cookTimeMin: 5,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: [
      "Банан очистить и нарезать кружочками толщиной около 5 мм.",
      "Выложить творог в тарелку, добавить банан и аккуратно перемешать.",
      "Полить мёдом сверху. Подавать сразу.",
    ],
    ingredients: [
      { name: "Творог 0%", amount: 150, unit: "г" },
      { name: "Банан", amount: 1, unit: "шт" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },

  // --- LUNCH (+16) ---
  {
    name: "Борщ",
    description: "Наваристый борщ со свёклой и говядиной",
    mealType: "LUNCH",
    cookTimeMin: 60,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Говядину залить 1.2-1.5 л холодной воды, довести до кипения на сильном огне и снять пену. Убавить огонь до слабого, варить под крышкой 40 минут до мягкости мяса. Мясо вынуть, бульон процедить через сито и вернуть в кастрюлю.",
      "Пока варится мясо: картофель нарезать кубиками, капусту нашинковать соломкой, свёклу и морковь натереть на крупной тёрке, лук мелко нарубить.",
      "Разогреть сковороду на среднем огне, обжарить лук 2-3 минуты до прозрачности, добавить морковь и свёклу и тушить 7-10 минут, помешивая. Добавить томатную пасту и тушить ещё 3-4 минуты.",
      "В процеженный бульон выложить картофель, довести до кипения и варить 10 минут.",
      "Добавить капусту и варить ещё 5 минут.",
      "Выложить свекольно-морковную поджарку, вернуть нарезанное мясо, посолить и поперчить по вкусу. Довести до кипения и варить ещё 5 минут.",
      "Снять с огня и дать борщу настояться под крышкой 10-15 минут перед подачей.",
    ],
    ingredients: [
      { name: "Свёкла", amount: 100, unit: "г" },
      { name: "Капуста белокочанная", amount: 100, unit: "г" },
      { name: "Картофель", amount: 150, unit: "г" },
      { name: "Морковь", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Говядина", amount: 100, unit: "г" },
      { name: "Паста томатная", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Солянка мясная",
    description: "Наваристая солянка с копчёностями и солёными огурцами",
    mealType: "LUNCH",
    cookTimeMin: 45,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Колбасу, ветчину и маринованные огурцы нарезать тонкой соломкой.",
      "Лук мелко нарезать. Разогреть сковороду на среднем огне, обжарить лук 2-3 минуты до прозрачности, добавить томатную пасту и обжарить ещё 2 минуты, помешивая.",
      "В кастрюлю выложить колбасу, ветчину, огурцы и обжаренный лук с томатной пастой, залить 700-800 мл воды.",
      "Довести до кипения на среднем огне, убавить огонь до слабого и варить под крышкой 15 минут.",
      "Добавить оливки, посолить и поперчить по вкусу, варить ещё 2-3 минуты.",
      "Разлить по тарелкам, в каждую добавить дольку лимона перед подачей.",
    ],
    ingredients: [
      { name: "Колбаса варёная", amount: 50, unit: "г" },
      { name: "Ветчина", amount: 50, unit: "г" },
      { name: "Огурцы маринованные", amount: 50, unit: "г" },
      { name: "Оливки консервированные", amount: 20, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Паста томатная", amount: 20, unit: "г" },
      { name: "Лимон", amount: 0.2, unit: "шт" },
    ],
  },
  {
    name: "Щи со свежей капустой",
    description: "Лёгкие щи с куриным бедром и свежей капустой",
    mealType: "LUNCH",
    cookTimeMin: 40,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: [],
    steps: [
      "Куриное бедро залить 1-1.2 л холодной воды, довести до кипения на сильном огне и снять пену.",
      "Убавить огонь до слабого, накрыть крышкой и варить 25 минут до мягкости мяса. Мясо вынуть, бульон процедить и вернуть в кастрюлю.",
      "Капусту нашинковать тонкой соломкой, картофель нарезать кубиками, морковь и лук измельчить.",
      "В бульон выложить картофель, довести до кипения и варить 10 минут, затем добавить капусту, морковь и лук и варить ещё 10 минут до мягкости овощей.",
      "Курицу отделить от кости, нарезать и вернуть в щи. Посолить, довести до кипения и снять с огня.",
    ],
    ingredients: [
      { name: "Капуста белокочанная", amount: 150, unit: "г" },
      { name: "Картофель", amount: 100, unit: "г" },
      { name: "Морковь", amount: 40, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Куриное бедро", amount: 100, unit: "г" },
    ],
  },
  {
    name: "Овощной суп-пюре из тыквы",
    description: "Нежный суп-пюре из тыквы со сливками",
    mealType: "LUNCH",
    cookTimeMin: 30,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое"],
    steps: [
      "Тыкву очистить и нарезать кубиками около 2 см, морковь и лук нарезать некрупно.",
      "Сложить овощи в кастрюлю, залить водой так, чтобы она едва покрывала овощи, довести до кипения на среднем огне.",
      "Убавить огонь до слабого и варить 15-20 минут до мягкости тыквы (должна легко протыкаться вилкой).",
      "Слить лишнюю жидкость, оставив немного отвара, и пробить блендером до однородного пюре.",
      "Влить сливки, перемешать и прогреть на слабом огне 2-3 минуты, не доводя до кипения. Посолить по вкусу.",
    ],
    ingredients: [
      { name: "Тыква", amount: 200, unit: "г" },
      { name: "Морковь", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Сливки 10%", amount: 50, unit: "мл" },
    ],
  },
  {
    name: "Куриная лапша",
    description: "Домашний суп с куриным филе и яичной лапшой",
    mealType: "LUNCH",
    cookTimeMin: 35,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: [],
    steps: [
      "Куриное филе залить 1-1.2 л холодной воды, довести до кипения на сильном огне, снять пену.",
      "Убавить огонь до слабого, варить 15-20 минут до готовности филе. Филе вынуть, бульон процедить и вернуть в кастрюлю.",
      "Морковь нарезать тонкой соломкой, лук — мелкими кубиками. Слегка обжарить на сухой сковороде или с каплей масла 2-3 минуты до мягкости.",
      "В бульон выложить обжаренные овощи и лапшу, варить 5-7 минут до готовности лапши.",
      "Куриное филе нарезать кусочками, вернуть в суп, посолить и довести до кипения.",
    ],
    ingredients: [
      { name: "Лапша яичная", amount: 80, unit: "г" },
      { name: "Куриное филе", amount: 100, unit: "г" },
      { name: "Морковь", amount: 40, unit: "г" },
      { name: "Лук репчатый", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Гороховый суп с беконом",
    description: "Сытный гороховый суп с копчёным беконом",
    mealType: "LUNCH",
    cookTimeMin: 50,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Горох промыть и замочить в холодной воде минимум на 1-2 часа (или использовать без замачивания, увеличив время варки).",
      "Горох залить 1-1.2 л свежей воды, довести до кипения на среднем огне, убавить огонь до слабого и варить 30 минут до мягкости, периодически снимая пену.",
      "Бекон нарезать небольшими кусочками и обжарить на сухой сковороде на среднем огне 3-4 минуты до золотистого цвета.",
      "Добавить к бекону нарезанные кубиками картофель, морковь и лук, обжарить вместе 3-4 минуты.",
      "Переложить обжарку в кастрюлю с горохом, варить ещё 10-15 минут до мягкости картофеля. Посолить по вкусу.",
    ],
    ingredients: [
      { name: "Горох колотый", amount: 80, unit: "г" },
      { name: "Бекон", amount: 50, unit: "г" },
      { name: "Картофель", amount: 100, unit: "г" },
      { name: "Морковь", amount: 40, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
    ],
  },
  {
    name: "Овощное рагу",
    description: "Лёгкое овощное рагу из кабачка, баклажана и болгарского перца",
    mealType: "LUNCH",
    cookTimeMin: 35,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "веган"],
    steps: [
      "Кабачок, баклажан, перец и помидор нарезать кубиками около 2 см, лук — мелкими кубиками.",
      "Разогреть сковороду или сотейник на среднем огне, влить оливковое масло и обжарить лук 2-3 минуты до прозрачности.",
      "Добавить баклажан, обжарить 5 минут, помешивая.",
      "Добавить кабачок и перец, перемешать, убавить огонь до слабого, накрыть крышкой и тушить 15 минут.",
      "Добавить помидор, посолить и поперчить, тушить ещё 5 минут без крышки, пока лишняя жидкость не выпарится.",
    ],
    ingredients: [
      { name: "Кабачок", amount: 150, unit: "г" },
      { name: "Баклажан", amount: 100, unit: "г" },
      { name: "Болгарский перец", amount: 1, unit: "шт" },
      { name: "Помидор", amount: 1, unit: "шт" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Масло оливковое", amount: 15, unit: "мл" },
    ],
  },
  {
    name: "Плов с бараниной",
    description: "Традиционный плов с бараниной, морковью и луком",
    mealType: "LUNCH",
    cookTimeMin: 60,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Баранину нарезать кубиками 2-3 см. Разогреть в казане или глубокой сковороде масло на среднем огне и обжарить мясо 7-10 минут до румяной корочки.",
      "Морковь нарезать соломкой, лук — полукольцами. Добавить к мясу и обжарить вместе 5-7 минут, пока лук не станет мягким и золотистым.",
      "Рис промыть в холодной воде 3-4 раза до прозрачной воды, всыпать поверх мяса с овощами и разровнять, не перемешивая.",
      "Залить кипятком так, чтобы вода покрывала рис на 1.5-2 см, посолить. Довести до кипения на сильном огне.",
      "Убавить огонь до минимального, накрыть крышкой и томить 30 минут, не поднимая крышку, пока рис не впитает воду и не станет мягким.",
      "Снять с огня и дать плову настояться под крышкой 10-15 минут, затем перемешать и подавать.",
    ],
    ingredients: [
      { name: "Рис длиннозёрный", amount: 100, unit: "г" },
      { name: "Баранина", amount: 150, unit: "г" },
      { name: "Морковь", amount: 60, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Масло подсолнечное", amount: 15, unit: "мл" },
    ],
  },
  {
    name: "Ризотто с грибами",
    description: "Кремовое ризотто с шампиньонами и сыром",
    mealType: "LUNCH",
    cookTimeMin: 40,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["вегетарианское", "сытно"],
    steps: [
      "Шампиньоны очистить и нарезать пластинками, лук мелко нарезать.",
      "Разогреть сковороду или сотейник на среднем огне, обжарить лук 2-3 минуты до прозрачности, добавить шампиньоны и жарить 5-6 минут, пока не выпарится жидкость и грибы не подрумянятся.",
      "Всыпать рис к грибам и луку, обжарить 2 минуты, помешивая, пока зёрна не станут полупрозрачными.",
      "Влить горячую воду порциями по 100-150 мл, каждый раз дожидаясь почти полного впитывания перед следующей порцией, постоянно помешивая — на это уйдёт около 20 минут, пока рис не станет мягким снаружи и слегка плотным внутри.",
      "Снять с огня, добавить сливки и тёртый сыр, энергично перемешать до кремовой консистенции. Подавать сразу.",
    ],
    ingredients: [
      { name: "Рис длиннозёрный", amount: 90, unit: "г" },
      { name: "Шампиньоны", amount: 150, unit: "г" },
      { name: "Сыр твёрдый", amount: 30, unit: "г" },
      { name: "Сливки 10%", amount: 50, unit: "мл" },
      { name: "Лук репчатый", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Паста карбонара",
    description: "Классическая паста с беконом, яйцом и сыром",
    mealType: "LUNCH",
    cookTimeMin: 25,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Отварить макароны в подсоленной кипящей воде согласно времени на упаковке до состояния al dente.",
      "Пока варятся макароны, бекон нарезать полосками и обжарить на сухой сковороде на среднем огне 4-5 минут до хруста.",
      "В отдельной миске взбить яйца со сливками и половиной тёртого сыра до однородности.",
      "Слить с макарон воду, оставив 2-3 ложки отвара, и сразу переложить макароны на сковороду с беконом, снять с огня.",
      "Быстро влить яичную смесь и энергично перемешать 30-40 секунд — тепло от макарон и сковороды загустит соус, не превращая его в яичницу. При необходимости добавить немного отвара для более жидкого соуса. Посыпать оставшимся сыром перед подачей.",
    ],
    ingredients: [
      { name: "Макароны", amount: 90, unit: "г" },
      { name: "Бекон", amount: 60, unit: "г" },
      { name: "Яйцо куриное", amount: 2, unit: "шт" },
      { name: "Сыр твёрдый", amount: 30, unit: "г" },
      { name: "Сливки 20%", amount: 50, unit: "мл" },
    ],
  },
  {
    name: "Куриные котлеты с гречкой",
    description: "Сочные куриные котлеты с гарниром из гречки",
    mealType: "LUNCH",
    cookTimeMin: 35,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Лук мелко нарезать или натереть на тёрке. Смешать фарш с яйцом и луком, посолить и поперчить, тщательно вымешать.",
      "Смочить руки водой, сформировать 3-4 котлеты овальной формы толщиной около 2 см.",
      "Разогреть сковороду на среднем огне, влить масло и обжарить котлеты по 4 минуты с каждой стороны до румяной корочки.",
      "Убавить огонь до слабого, накрыть крышкой и довести до готовности ещё 5 минут.",
      "Пока жарятся котлеты, отдельно отварить гречку в подсоленной воде 15 минут до готовности. Подавать котлеты с гречкой.",
    ],
    ingredients: [
      { name: "Фарш куриный", amount: 150, unit: "г" },
      { name: "Яйцо куриное", amount: 1, unit: "шт" },
      { name: "Гречка", amount: 70, unit: "г" },
      { name: "Лук репчатый", amount: 20, unit: "г" },
      { name: "Масло подсолнечное", amount: 10, unit: "мл" },
    ],
  },
  {
    name: "Тефтели с рисом в томатном соусе",
    description: "Говяжьи тефтели с рисом, тушённые в томатном соусе",
    mealType: "LUNCH",
    cookTimeMin: 45,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Рис отварить в подсоленной воде 15 минут до полуготовности, остудить.",
      "Смешать фарш с отваренным рисом, посолить и поперчить, тщательно вымешать.",
      "Смочить руки водой и сформировать 5-6 тефтелей размером с небольшой апельсин.",
      "Морковь натереть на тёрке, лук мелко нарезать. Разогреть сковороду на среднем огне, обжарить лук и морковь 3-4 минуты, добавить томатную пасту и воды, перемешать и довести до кипения.",
      "Выложить тефтели в соус, убавить огонь до слабого, накрыть крышкой и тушить 20 минут, не перемешивая, чтобы тефтели не развалились.",
    ],
    ingredients: [
      { name: "Фарш говяжий", amount: 150, unit: "г" },
      { name: "Рис длиннозёрный", amount: 40, unit: "г" },
      { name: "Паста томатная", amount: 30, unit: "г" },
      { name: "Морковь", amount: 30, unit: "г" },
      { name: "Лук репчатый", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Салат Цезарь с курицей",
    description: "Салат с куриным филе, листьями салата и сухариками",
    mealType: "LUNCH",
    cookTimeMin: 20,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["лёгкое"],
    steps: [
      "Куриное филе посолить и поперчить, разрезать вдоль на 2 плоских пласта для более быстрой прожарки.",
      "Разогреть сковороду на среднем огне с каплей масла, обжарить филе 4-5 минут с каждой стороны до золотистой корочки и полной готовности. Остудить и нарезать полосками.",
      "Листья салата вымыть, обсушить и порвать руками на крупные куски.",
      "Сыр натереть на тёрке или настрогать тонкими пластинами овощечисткой.",
      "Сложить салат, курицу, сыр и сухарики в глубокой миске, заправить оливковым маслом и аккуратно перемешать. Подавать сразу, пока сухарики хрустящие.",
    ],
    ingredients: [
      { name: "Куриное филе", amount: 100, unit: "г" },
      { name: "Салат листовой", amount: 50, unit: "г" },
      { name: "Сыр твёрдый", amount: 20, unit: "г" },
      { name: "Панировочные сухари", amount: 20, unit: "г" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
    ],
  },
  {
    name: "Греческий салат",
    description: "Лёгкий салат с огурцом, помидором, фетой и оливками",
    mealType: "LUNCH",
    cookTimeMin: 10,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: [
      "Огурец и помидор нарезать крупными кубиками около 2 см.",
      "Фету нарезать кубиками того же размера, стараясь не раскрошить.",
      "Сложить огурец, помидор, фету и оливки в тарелку, аккуратно перемешать, чтобы не помять сыр.",
      "Заправить оливковым маслом непосредственно перед подачей.",
    ],
    ingredients: [
      { name: "Огурец", amount: 1, unit: "шт" },
      { name: "Помидор", amount: 1, unit: "шт" },
      { name: "Сыр фета", amount: 50, unit: "г" },
      { name: "Оливки консервированные", amount: 20, unit: "г" },
      { name: "Масло оливковое", amount: 15, unit: "мл" },
    ],
  },
  {
    name: "Крем-суп из брокколи",
    description: "Нежный крем-суп из брокколи со сливками",
    mealType: "LUNCH",
    cookTimeMin: 25,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое"],
    steps: [
      "Брокколи разобрать на соцветия, картофель нарезать кубиками, лук мелко нарезать.",
      "Разогреть кастрюлю на среднем огне с каплей масла, обжарить лук 2-3 минуты до прозрачности.",
      "Добавить картофель и брокколи, залить водой так, чтобы она едва покрывала овощи. Довести до кипения, убавить огонь до слабого и варить 15 минут до мягкости овощей.",
      "Слить лишнюю жидкость, оставив немного отвара, и пробить блендером до однородного пюре.",
      "Влить сливки, посолить по вкусу и прогреть 2 минуты на слабом огне, не доводя до кипения.",
    ],
    ingredients: [
      { name: "Брокколи", amount: 200, unit: "г" },
      { name: "Картофель", amount: 50, unit: "г" },
      { name: "Сливки 10%", amount: 50, unit: "мл" },
      { name: "Лук репчатый", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Кускус с овощами и нутом",
    description: "Кускус с болгарским перцем, кабачком и нутом",
    mealType: "LUNCH",
    cookTimeMin: 25,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "веган"],
    steps: [
      "Кускус залить равным объёмом кипятка, накрыть крышкой и оставить набухать 5 минут, затем взрыхлить вилкой.",
      "Перец и кабачок нарезать небольшими кубиками.",
      "Разогреть сковороду на среднем огне, влить оливковое масло и обжарить кабачок с перцем 5-7 минут, помешивая, до мягкости и лёгкой золотистости.",
      "Добавить отваренный нут, прогреть вместе 2 минуты.",
      "Смешать овощи с нутом и разбухшим кускусом, посолить по вкусу и перемешать. Подавать тёплым.",
    ],
    ingredients: [
      { name: "Кускус", amount: 80, unit: "г" },
      { name: "Нут", amount: 60, unit: "г" },
      { name: "Болгарский перец", amount: 1, unit: "шт" },
      { name: "Кабачок", amount: 100, unit: "г" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
    ],
  },

  // --- DINNER (+16) ---
  {
    name: "Куриные бёдра запечённые с картофелем",
    description: "Куриные бёдра, запечённые с картофелем и розмарином",
    mealType: "DINNER",
    cookTimeMin: 50,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["сытно"],
    steps: [
      "Разогреть духовку до 200°C.",
      "Картофель нарезать дольками толщиной около 1.5 см.",
      "Куриные бёдра и картофель выложить на противень в один слой, посолить и поперчить.",
      "Сбрызнуть маслом, посыпать розмарином и слегка перемешать руками, чтобы масло и специи распределились равномерно.",
      "Запекать 35-40 минут, пока кожица бёдер не станет золотистой и хрустящей, а картофель — мягким внутри с румяной корочкой.",
    ],
    ingredients: [
      { name: "Куриное бедро", amount: 200, unit: "г" },
      { name: "Картофель", amount: 200, unit: "г" },
      { name: "Масло подсолнечное", amount: 15, unit: "мл" },
      { name: "Розмарин", amount: 2, unit: "г" },
    ],
  },
  {
    name: "Стейк из говядины с овощами гриль",
    description: "Говяжий стейк с кабачком и болгарским перцем на гриле",
    mealType: "DINNER",
    cookTimeMin: 25,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Стейк за 15-20 минут до жарки достать из холодильника, обсушить бумажным полотенцем, посолить и поперчить с обеих сторон.",
      "Разогреть сухую сковороду на сильном огне до появления лёгкого дымка.",
      "Обжарить стейк по 3-4 минуты с каждой стороны до румяной корочки (для средней прожарки).",
      "Переложить стейк на тарелку, накрыть фольгой и дать отдохнуть 5 минут — так сок равномерно распределится внутри.",
      "Пока стейк отдыхает, кабачок и перец нарезать крупными кусками, обжарить на той же сковороде с оливковым маслом 5-7 минут до мягкости и лёгкой румяности.",
    ],
    ingredients: [
      { name: "Говяжий стейк", amount: 200, unit: "г" },
      { name: "Кабачок", amount: 100, unit: "г" },
      { name: "Болгарский перец", amount: 1, unit: "шт" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
    ],
  },
  {
    name: "Форель на пару с лимоном",
    description: "Диетическая форель, приготовленная на пару, с лимоном и укропом",
    mealType: "DINNER",
    cookTimeMin: 20,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["лёгкое"],
    steps: [
      "Филе форели посолить, сбрызнуть соком, выжатым из дольки лимона, и оливковым маслом.",
      "Налить воду в пароварку или в кастрюлю с решёткой, довести до кипения.",
      "Выложить филе на решётку кожей вниз и готовить на пару 12-15 минут, пока мясо не станет непрозрачным и не начнёт легко разделяться вилкой.",
      "Мелко нарезать укроп.",
      "Выложить готовую форель на тарелку, посыпать укропом перед подачей.",
    ],
    ingredients: [
      { name: "Форель", amount: 180, unit: "г" },
      { name: "Лимон", amount: 0.3, unit: "шт" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
      { name: "Укроп", amount: 5, unit: "г" },
    ],
  },
  {
    name: "Индейка с овощным рагу",
    description: "Филе индейки, тушённое с кабачком, морковью и луком",
    mealType: "DINNER",
    cookTimeMin: 35,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["лёгкое"],
    steps: [
      "Индейку нарезать кубиками около 2 см.",
      "Разогреть сковороду на среднем огне с каплей масла, обжарить индейку 5-7 минут до лёгкой золотистой корочки.",
      "Морковь и лук нарезать некрупно, кабачок — кубиками. Добавить овощи к индейке и перемешать.",
      "Убавить огонь до слабого, накрыть крышкой и тушить 15-20 минут, изредка помешивая, пока овощи не станут мягкими. Посолить по вкусу.",
    ],
    ingredients: [
      { name: "Индейка филе", amount: 180, unit: "г" },
      { name: "Кабачок", amount: 100, unit: "г" },
      { name: "Морковь", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
    ],
  },
  {
    name: "Свинина в духовке с яблоками",
    description: "Запечённая свинина с кисло-сладкими яблоками",
    mealType: "DINNER",
    cookTimeMin: 60,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Разогреть духовку до 190°C.",
      "Свинину промыть, обсушить, посолить и поперчить со всех сторон.",
      "Яблоко разрезать на дольки, удалив сердцевину.",
      "Выложить свинину на противень, обложить дольками яблока, сбрызнуть маслом.",
      "Запекать 40-45 минут до готовности мяса внутри (сок при прокалывании должен быть прозрачным) и мягкости яблок. Дать мясу отдохнуть 5 минут перед нарезкой.",
    ],
    ingredients: [
      { name: "Свинина", amount: 200, unit: "г" },
      { name: "Яблоко", amount: 1, unit: "шт" },
      { name: "Масло подсолнечное", amount: 10, unit: "мл" },
    ],
  },
  {
    name: "Кролик тушёный со сметаной",
    description: "Нежное мясо кролика, тушённое в сметанном соусе с луком и морковью",
    mealType: "DINNER",
    cookTimeMin: 55,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: [],
    steps: [
      "Кролика нарезать порционными кусочками.",
      "Разогреть сковороду или сотейник на среднем огне, обжарить кусочки кролика 5-7 минут со всех сторон до румяной корочки.",
      "Лук и морковь нарезать некрупно, добавить к мясу и обжарить вместе 5 минут.",
      "Смешать сметану со 100 мл воды, влить к мясу с овощами, посолить.",
      "Убавить огонь до слабого, накрыть крышкой и тушить 30 минут, изредка помешивая, пока мясо не станет мягким.",
    ],
    ingredients: [
      { name: "Кролик", amount: 200, unit: "г" },
      { name: "Сметана 20%", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Морковь", amount: 40, unit: "г" },
    ],
  },
  {
    name: "Рыба запечённая с овощами",
    description: "Филе хека, запечённое с помидором и луком",
    mealType: "DINNER",
    cookTimeMin: 30,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["лёгкое"],
    steps: [
      "Разогреть духовку до 190°C.",
      "Помидор и лук нарезать тонкими полукольцами.",
      "Выложить филе хека на противень или в форму для запекания, посолить.",
      "Сверху выложить помидор и лук внахлёст, сбрызнуть оливковым маслом.",
      "Запекать 20 минут, пока рыба не станет непрозрачной и не начнёт легко разделяться вилкой.",
    ],
    ingredients: [
      { name: "Хек", amount: 180, unit: "г" },
      { name: "Помидор", amount: 1, unit: "шт" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
    ],
  },
  {
    name: "Курица терияки с рисом",
    description: "Куриное филе в соусе терияки с отварным рисом",
    mealType: "DINNER",
    cookTimeMin: 30,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["сытно"],
    steps: [
      "Рис промыть в холодной воде до прозрачной воды, отварить в подсоленной воде 15-18 минут до готовности.",
      "Куриное филе нарезать некрупными кусочками.",
      "Разогреть сковороду на среднем огне с каплей масла, обжарить курицу 5-6 минут до золотистой корочки и полной готовности.",
      "Влить соус терияки, убавить огонь до слабого и тушить 5 минут, периодически помешивая, пока соус не загустеет и не покроет курицу глазурью.",
      "Подавать курицу с отварным рисом.",
    ],
    ingredients: [
      { name: "Куриное филе", amount: 150, unit: "г" },
      { name: "Рис длиннозёрный", amount: 80, unit: "г" },
      { name: "Соус терияки", amount: 30, unit: "мл" },
    ],
  },
  {
    name: "Овощная запеканка с сыром",
    description: "Запеканка из кабачка, баклажана и помидора под сыром",
    mealType: "DINNER",
    cookTimeMin: 45,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["вегетарианское"],
    steps: [
      "Разогреть духовку до 190°C.",
      "Кабачок, баклажан и помидор нарезать кружочками толщиной около 5 мм.",
      "Смазать форму для запекания маслом, выложить овощи внахлёст чередующимися рядами (кабачок, баклажан, помидор).",
      "Яйцо взбить с щепоткой соли, залить овощи, посыпать тёртым сыром.",
      "Запекать 25-30 минут, пока сыр не расплавится и не подрумянится, а овощи не станут мягкими.",
    ],
    ingredients: [
      { name: "Кабачок", amount: 150, unit: "г" },
      { name: "Баклажан", amount: 100, unit: "г" },
      { name: "Помидор", amount: 1, unit: "шт" },
      { name: "Сыр твёрдый", amount: 50, unit: "г" },
      { name: "Яйцо куриное", amount: 1, unit: "шт" },
    ],
  },
  {
    name: "Тушёная брюссельская капуста с беконом",
    description: "Брюссельская капуста, тушённая с беконом и луком",
    mealType: "DINNER",
    cookTimeMin: 25,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: [],
    steps: [
      "Капусту промыть, удалить внешние повреждённые листья и разрезать каждый кочанчик пополам.",
      "Бекон нарезать небольшими кусочками, лук — мелкими кубиками.",
      "Разогреть сковороду на среднем огне, обжарить бекон 3-4 минуты до золотистого цвета, добавить лук и обжарить ещё 2 минуты.",
      "Добавить капусту срезом вниз, влить 50 мл воды, посолить.",
      "Убавить огонь до слабого, накрыть крышкой и тушить 12-15 минут, пока капуста не станет мягкой, но сохранит лёгкую хрусткость.",
    ],
    ingredients: [
      { name: "Брюссельская капуста", amount: 200, unit: "г" },
      { name: "Бекон", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Кальмары жареные с чесноком",
    description: "Быстрые жареные кальмары с чесноком и лимоном",
    mealType: "DINNER",
    cookTimeMin: 15,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["лёгкое", "быстро"],
    steps: [
      "Кальмара нарезать кольцами шириной около 1 см, обсушить бумажным полотенцем (важно, чтобы не было лишней влаги).",
      "Чеснок мелко нарубить или пропустить через пресс.",
      "Разогреть сковороду на сильном огне до появления лёгкого дымка, влить масло.",
      "Обжарить кальмара 1-2 минуты, постоянно помешивая — важно не передержать, иначе он станет резиновым.",
      "Снять с огня, добавить чеснок и сок, выжатый из лимона, быстро перемешать. Подавать сразу.",
    ],
    ingredients: [
      { name: "Кальмар", amount: 200, unit: "г" },
      { name: "Чеснок", amount: 5, unit: "г" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
      { name: "Лимон", amount: 0.2, unit: "шт" },
    ],
  },
  {
    name: "Скумбрия запечённая",
    description: "Скумбрия, запечённая целиком с лимоном",
    mealType: "DINNER",
    cookTimeMin: 30,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: [],
    steps: [
      "Разогреть духовку до 200°C.",
      "Скумбрию промыть, обсушить и сделать 2-3 неглубоких надреза на боках.",
      "Натереть рыбу солью снаружи и внутри, положить внутрь тонкие дольки лимона.",
      "Выложить рыбу на противень, застеленный фольгой или пергаментом.",
      "Запекать 20-25 минут, пока кожица не станет золотистой, а мясо у позвоночника — непрозрачным.",
    ],
    ingredients: [
      { name: "Скумбрия", amount: 200, unit: "г" },
      { name: "Лимон", amount: 0.3, unit: "шт" },
      { name: "Соль", amount: 1, unit: "г" },
    ],
  },
  {
    name: "Овощной плов вегетарианский",
    description: "Плов без мяса с морковью, луком и нутом",
    mealType: "DINNER",
    cookTimeMin: 45,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["вегетарианское", "веган"],
    steps: [
      "Морковь нарезать соломкой, лук — полукольцами.",
      "Разогреть казан или глубокую сковороду на среднем огне, влить масло и обжарить лук 2-3 минуты до прозрачности, добавить морковь и жарить ещё 5 минут.",
      "Добавить отваренный нут, обжарить вместе 3-4 минуты, посолить.",
      "Рис промыть в холодной воде до прозрачной воды, всыпать поверх овощей и разровнять, не перемешивая.",
      "Залить кипятком так, чтобы вода покрывала рис на 1.5 см, довести до кипения на сильном огне.",
      "Убавить огонь до минимального, накрыть крышкой и тушить 25 минут, не поднимая крышку, пока рис не впитает воду. Дать настояться 5-10 минут, затем перемешать.",
    ],
    ingredients: [
      { name: "Рис длиннозёрный", amount: 90, unit: "г" },
      { name: "Морковь", amount: 60, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Нут", amount: 50, unit: "г" },
      { name: "Масло подсолнечное", amount: 15, unit: "мл" },
    ],
  },
  {
    name: "Судак под овощами",
    description: "Филе судака, тушённое с морковью, луком и сметаной",
    mealType: "DINNER",
    cookTimeMin: 35,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: [],
    steps: [
      "Филе судака посолить и поперчить.",
      "Разогреть сковороду на среднем огне с каплей масла, обжарить филе по 2-3 минуты с каждой стороны до лёгкой золотистой корочки.",
      "Морковь натереть на тёрке, лук нарезать полукольцами. На отдельной сковороде обжарить овощи 5-7 минут до мягкости.",
      "Выложить обжаренные овощи поверх рыбы, сметану развести небольшим количеством воды и залить сверху.",
      "Убавить огонь до слабого, накрыть крышкой и тушить 10 минут, пока рыба полностью не пропитается соусом.",
    ],
    ingredients: [
      { name: "Судак", amount: 180, unit: "г" },
      { name: "Морковь", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
      { name: "Сметана 20%", amount: 30, unit: "г" },
    ],
  },
  {
    name: "Баранина тушёная с черносливом",
    description: "Баранина, тушённая с черносливом и луком",
    mealType: "DINNER",
    cookTimeMin: 65,
    servings: 1,
    isFrac: true,
    difficulty: "MEDIUM",
    tags: ["сытно"],
    steps: [
      "Баранину нарезать кубиками около 3 см.",
      "Разогреть сковороду или казан на среднем огне, обжарить баранину 7-10 минут до румяной корочки со всех сторон.",
      "Лук нарезать полукольцами, добавить к мясу и обжарить вместе 5 минут, пока лук не станет мягким.",
      "Чернослив промыть, при необходимости разрезать крупные ягоды пополам, добавить к мясу.",
      "Влить 200 мл воды, посолить, убавить огонь до слабого, накрыть крышкой и тушить 40 минут, изредка помешивая, пока мясо не станет мягким.",
    ],
    ingredients: [
      { name: "Баранина", amount: 200, unit: "г" },
      { name: "Чернослив", amount: 50, unit: "г" },
      { name: "Лук репчатый", amount: 30, unit: "г" },
    ],
  },
  {
    name: "Лёгкий омлет с овощами на ужин",
    description: "Омлет с помидором и шпинатом на оливковом масле",
    mealType: "DINNER",
    cookTimeMin: 15,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: [
      "Помидор нарезать небольшими кубиками.",
      "Разогреть сковороду на среднем огне, влить оливковое масло и обжарить помидор 2 минуты.",
      "Добавить шпинат и обжарить ещё 1-2 минуты, пока листья не осядут.",
      "Яйца взбить с щепоткой соли, вылить поверх овощей.",
      "Убавить огонь до слабого, накрыть крышкой и готовить 4-5 минут, пока омлет не схватится по всей толщине.",
    ],
    ingredients: [
      { name: "Яйцо куриное", amount: 3, unit: "шт" },
      { name: "Помидор", amount: 1, unit: "шт" },
      { name: "Шпинат", amount: 50, unit: "г" },
      { name: "Масло оливковое", amount: 10, unit: "мл" },
    ],
  },

  // --- SNACK (+16) ---
  {
    name: "Хумус с овощами",
    description: "Нутовый хумус с морковью и огурцом для перекуса",
    mealType: "SNACK",
    cookTimeMin: 15,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "веган"],
    steps: [
      "Отваренный нут откинуть на дуршлаг, дать стечь лишней жидкости.",
      "Переложить нут в чашу блендера, добавить оливковое масло и щепотку соли.",
      "Пробить блендером 1-2 минуты до однородной пастообразной консистенции, при необходимости добавляя 1-2 столовые ложки воды для нужной густоты.",
      "Огурец и морковь вымыть и нарезать длинными палочками толщиной около 1 см.",
      "Выложить хумус в пиалу, подавать с овощными палочками.",
    ],
    ingredients: [
      { name: "Нут", amount: 100, unit: "г" },
      { name: "Масло оливковое", amount: 15, unit: "мл" },
      { name: "Огурец", amount: 1, unit: "шт" },
      { name: "Морковь", amount: 50, unit: "г" },
    ],
  },
  {
    name: "Ореховый батончик домашний",
    description: "Энергетический батончик из фиников, грецкого ореха и кешью",
    mealType: "SNACK",
    cookTimeMin: 15,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "веган"],
    steps: [
      "Финики промыть, при необходимости удалить косточки.",
      "Сложить финики, грецкий орех и кешью в чашу блендера и измельчить импульсами до состояния липкой вязкой массы (не превращая орехи в пыль).",
      "Смочить руки водой, переложить массу на пищевую плёнку и сформировать плотный батончик или несколько шариков.",
      "Завернуть в плёнку и убрать в холодильник на 20 минут, чтобы батончик схватился и стал плотнее.",
    ],
    ingredients: [
      { name: "Финики", amount: 4, unit: "шт" },
      { name: "Грецкий орех", amount: 20, unit: "г" },
      { name: "Кешью", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Сырные палочки",
    description: "Хрустящие сырные палочки из теста с сыром",
    mealType: "SNACK",
    cookTimeMin: 25,
    servings: 1,
    isFrac: false,
    difficulty: "MEDIUM",
    tags: ["вегетарианское"],
    steps: [
      "Разогреть духовку до 190°C, застелить противень пергаментом.",
      "Сыр натереть на мелкой тёрке и разделить пополам.",
      "Яйцо взбить вилкой, смешать с мукой и половиной сыра до однородного липкого теста.",
      "Сформировать из теста 6-8 тонких палочек длиной около 10 см, выложить на противень с промежутками, посыпать оставшимся сыром.",
      "Выпекать 12-15 минут, пока палочки не подрумянятся и не станут золотистыми. Дать остыть 3-5 минут перед подачей — так они станут более хрустящими.",
    ],
    ingredients: [
      { name: "Сыр твёрдый", amount: 50, unit: "г" },
      { name: "Мука пшеничная", amount: 20, unit: "г" },
      { name: "Яйцо куриное", amount: 1, unit: "шт" },
    ],
  },
  {
    name: "Творожный десерт с малиной",
    description: "Творог с малиной и мёдом",
    mealType: "SNACK",
    cookTimeMin: 5,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: [
      "Малину аккуратно промыть и обсушить.",
      "Выложить творог в глубокую пиалу.",
      "Сверху выложить малину и полить мёдом. Подавать сразу.",
    ],
    ingredients: [
      { name: "Творог 5%", amount: 100, unit: "г" },
      { name: "Малина", amount: 50, unit: "г" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Запечённые яблочные дольки",
    description: "Яблоко, запечённое дольками с корицей",
    mealType: "SNACK",
    cookTimeMin: 20,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "веган"],
    steps: [
      "Разогреть духовку до 180°C, застелить противень пергаментом.",
      "Яблоки вымыть, разрезать на дольки толщиной около 1 см, удалив сердцевину.",
      "Выложить дольки на противень в один слой, равномерно посыпать корицей.",
      "Запекать 15 минут, пока дольки не станут мягкими и слегка карамелизуются по краям. Подавать тёплыми.",
    ],
    ingredients: [
      { name: "Яблоко", amount: 2, unit: "шт" },
      { name: "Корица молотая", amount: 2, unit: "г" },
    ],
  },
  {
    name: "Смузи зелёный",
    description: "Смузи со шпинатом, бананом и киви",
    mealType: "SNACK",
    cookTimeMin: 10,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое"],
    steps: [
      "Шпинат промыть, банан и киви очистить и нарезать крупными кусочками.",
      "Сложить шпинат, банан, киви и йогурт в чашу блендера.",
      "Взбить 30-40 секунд до однородной ярко-зелёной консистенции без крупных кусочков листьев. Подавать сразу.",
    ],
    ingredients: [
      { name: "Шпинат", amount: 50, unit: "г" },
      { name: "Банан", amount: 1, unit: "шт" },
      { name: "Киви", amount: 1, unit: "шт" },
      { name: "Йогурт натуральный", amount: 100, unit: "г" },
    ],
  },
  {
    name: "Кесадилья с сыром",
    description: "Пшеничная тортилья с расплавленным сыром",
    mealType: "SNACK",
    cookTimeMin: 10,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро"],
    steps: [
      "Сыр натереть на тёрке.",
      "Посыпать сыром половину тортильи, сложить пополам, слегка прижав.",
      "Разогреть сухую сковороду на среднем огне, выложить тортилью и обжарить 2 минуты с одной стороны, пока низ не подрумянится.",
      "Перевернуть и обжарить ещё 2 минуты с другой стороны, пока сыр полностью не расплавится. Разрезать на треугольники перед подачей.",
    ],
    ingredients: [
      { name: "Тортилья пшеничная", amount: 1, unit: "шт" },
      { name: "Сыр твёрдый", amount: 40, unit: "г" },
    ],
  },
  {
    name: "Хлебцы с авокадо",
    description: "Цельнозерновые хлебцы с размятым авокадо",
    mealType: "SNACK",
    cookTimeMin: 5,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро", "веган"],
    steps: [
      "Авокадо разрезать пополам, вынуть мякоть половины ложкой.",
      "Размять мякоть авокадо вилкой до состояния грубого пюре, посолить и перемешать.",
      "Намазать авокадо ровным слоем на хлебцы. Подавать сразу.",
    ],
    ingredients: [
      { name: "Хлебцы цельнозерновые", amount: 30, unit: "г" },
      { name: "Авокадо", amount: 0.5, unit: "шт" },
      { name: "Соль", amount: 1, unit: "г" },
    ],
  },
  {
    name: "Протеиновый шейк с бананом",
    description: "Молочный коктейль с творогом и бананом",
    mealType: "SNACK",
    cookTimeMin: 5,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро"],
    steps: [
      "Банан очистить и разломать на несколько кусочков.",
      "Сложить творог, молоко и банан в чашу блендера.",
      "Взбить 30-40 секунд до однородной, без комков консистенции. Подавать сразу.",
    ],
    ingredients: [
      { name: "Творог 0%", amount: 100, unit: "г" },
      { name: "Молоко 1.5%", amount: 200, unit: "мл" },
      { name: "Банан", amount: 1, unit: "шт" },
    ],
  },
  {
    name: "Овощные палочки с йогуртовым соусом",
    description: "Морковь и сельдерей с натуральным йогуртом",
    mealType: "SNACK",
    cookTimeMin: 10,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое"],
    steps: [
      "Морковь и сельдерей вымыть, при необходимости очистить морковь.",
      "Нарезать морковь и сельдерей длинными палочками толщиной около 1 см.",
      "Йогурт выложить в небольшую пиалу, при желании посолить и поперчить по вкусу.",
      "Подавать овощные палочки, макая их в йогурт.",
    ],
    ingredients: [
      { name: "Морковь", amount: 100, unit: "г" },
      { name: "Сельдерей стебель", amount: 50, unit: "г" },
      { name: "Йогурт натуральный", amount: 80, unit: "г" },
    ],
  },
  {
    name: "Сухофрукты микс",
    description: "Смесь кураги, чернослива и изюма",
    mealType: "SNACK",
    cookTimeMin: 2,
    servings: 1,
    isFrac: true,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро", "веган"],
    steps: [
      "Курагу и чернослив при необходимости промыть тёплой водой и обсушить бумажным полотенцем, крупные ягоды нарезать пополам.",
      "Смешать курагу, чернослив и изюм в пиале. Подавать сразу или хранить в закрытой ёмкости.",
    ],
    ingredients: [
      { name: "Курага", amount: 30, unit: "г" },
      { name: "Чернослив", amount: 30, unit: "г" },
      { name: "Изюм", amount: 20, unit: "г" },
    ],
  },
  {
    name: "Тост с арахисом и мёдом",
    description: "Цельнозерновой тост с дроблёным арахисом и мёдом",
    mealType: "SNACK",
    cookTimeMin: 5,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "быстро"],
    steps: [
      "Арахис крупно порубить ножом или раздавить скалкой.",
      "Ломтики хлеба подсушить в тостере 2-3 минуты до золотистой корочки.",
      "Посыпать тосты дроблёным арахисом и полить мёдом сверху. Подавать сразу, пока тосты тёплые.",
    ],
    ingredients: [
      { name: "Хлеб цельнозерновой", amount: 2, unit: "шт" },
      { name: "Арахис", amount: 30, unit: "г" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Кефирный коктейль с черникой",
    description: "Кефир, взбитый с черникой и мёдом",
    mealType: "SNACK",
    cookTimeMin: 5,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "лёгкое", "быстро"],
    steps: [
      "Чернику промыть и обсушить (если использовалась замороженная — разморозить 5 минут).",
      "Сложить кефир, чернику и мёд в чашу блендера.",
      "Взбить 20-30 секунд до однородной консистенции. Подавать сразу, пока коктейль холодный.",
    ],
    ingredients: [
      { name: "Кефир 1%", amount: 200, unit: "мл" },
      { name: "Черника", amount: 50, unit: "г" },
      { name: "Мёд", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Творожные шарики с кокосом",
    description: "Творожные шарики, обваленные в кокосовой стружке",
    mealType: "SNACK",
    cookTimeMin: 15,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское"],
    steps: [
      "Творог размять вилкой, добавить мёд и тщательно перемешать до однородности.",
      "Смочить руки холодной водой, сформировать 8-10 небольших шариков размером с грецкий орех.",
      "Обвалять каждый шарик в кокосовой стружке со всех сторон.",
      "Убрать в холодильник на 10-15 минут, чтобы шарики стали плотнее, перед подачей.",
    ],
    ingredients: [
      { name: "Творог 9%", amount: 150, unit: "г" },
      { name: "Кокосовая стружка", amount: 20, unit: "г" },
      { name: "Мёд", amount: 15, unit: "г" },
    ],
  },
  {
    name: "Гранола домашняя порция",
    description: "Овсяные хлопья с мёдом, миндалём и тыквенными семечками",
    mealType: "SNACK",
    cookTimeMin: 20,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["вегетарианское", "сытно"],
    steps: [
      "Разогреть духовку до 160°C, застелить противень пергаментом.",
      "Овсяные хлопья смешать с мёдом до равномерного распределения.",
      "Выложить хлопья тонким слоем на противень, запекать 12-15 минут, перемешивая каждые 5 минут, пока не станут золотистыми и хрустящими.",
      "Миндаль крупно порубить ножом.",
      "Смешать остывшие хлопья с миндалём и тыквенными семечками. Хранить в закрытой ёмкости или подавать сразу.",
    ],
    ingredients: [
      { name: "Овсяные хлопья", amount: 40, unit: "г" },
      { name: "Мёд", amount: 15, unit: "г" },
      { name: "Миндаль", amount: 15, unit: "г" },
      { name: "Тыквенные семечки", amount: 10, unit: "г" },
    ],
  },
  {
    name: "Мини-сэндвичи с ветчиной",
    description: "Маленькие сэндвичи с ветчиной и огурцом",
    mealType: "SNACK",
    cookTimeMin: 10,
    servings: 1,
    isFrac: false,
    difficulty: "EASY",
    tags: ["быстро"],
    steps: [
      "Огурец нарезать тонкими ломтиками толщиной около 3 мм.",
      "Ветчину нарезать тонкими пластинами, если она не нарезана.",
      "Выложить ветчину и ломтики огурца ровным слоем на один ломтик хлеба.",
      "Накрыть вторым ломтиком хлеба, слегка прижать и разрезать на 4 маленьких треугольника или квадрата. Подавать сразу.",
    ],
    ingredients: [
      { name: "Хлеб пшеничный", amount: 2, unit: "шт" },
      { name: "Ветчина", amount: 40, unit: "г" },
      { name: "Огурец", amount: 0.5, unit: "шт" },
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

  // На ~80 блюдах молчаливый console.warn недостаточен (§12 критерий готовности
  // Фазы 5: "isKcalSane ЗЕЛЁНЫЙ по всем блюдам") — собираем все несуразности и
  // валим seed одной понятной ошибкой в конце, а не молча пропускаем часть данных.
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
