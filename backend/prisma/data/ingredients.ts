import type { IngredientCategory } from "@prisma/client";

// КБЖУ — типовые табличные значения на 100 г. Для новых ингредиентов
// kcal100 выводится формулой round(4*Б + 9*Ж + 4*У) (§7.5), не с этикетки,
// чтобы любое блюдо из них автоматически проходило isKcalSane.
export interface SeedIngredient {
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
export const INGREDIENTS: SeedIngredient[] = [
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
