// GET/POST/PATCH/DELETE /api/shopping* (§6.4, §8 спецификации).
import type { FastifyPluginAsync } from "fastify";
import type { Ingredient, ShoppingItem, ShoppingItemSource } from "@prisma/client";
import { IngredientCategory } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../lib/errors";
import {
  addShoppingItemSchema,
  dishIdParamSchema,
  fromDishBodySchema,
  patchShoppingItemSchema,
  shoppingIdParamSchema,
} from "../schemas/shopping";
import { matchIngredient, normalizeName } from "../services/matching";
import { classifyCategory } from "../services/ai/classify";
import { AiServiceError } from "../services/ai/errors";

// Порядок групп в ответе GET /api/shopping — по порядку объявления enum.
const CATEGORY_ORDER = Object.values(IngredientCategory);

type ShoppingItemWithIngredient = ShoppingItem & { ingredient: Ingredient | null };

function serializeShoppingItem(item: ShoppingItemWithIngredient) {
  return {
    id: item.id,
    ingredientId: item.ingredientId,
    name: item.customName ?? item.ingredient?.name ?? "",
    category: item.category,
    amount: item.amount,
    unit: item.unit,
    checked: item.checked,
    source: item.source,
    createdAt: item.createdAt,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Ручное добавление без количества/единицы (напр. просто "тест") должно
// давать осмысленную позицию, а не пустую строку без цифр, и корректно
// суммироваться при повторном вводе того же имени ("тест" + "тест" → "2 шт").
const DEFAULT_MANUAL_AMOUNT = 1;
const DEFAULT_MANUAL_UNIT = "шт";

// Отображаемые названия продуктов — с большой буквы (как в seed, напр.
// "Куриное филе"), независимо от того, как ввёл пользователь.
function capitalizeFirst(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

// Слияние количества в уже найденную позицию списка покупок. Общая логика
// для merge по ingredientId и merge по нормализованному customName
// (см. addOrMergeManualUnresolvedItem ниже).
async function mergeIntoExistingItem(
  existing: ShoppingItemWithIngredient,
  params: { amount: number | null; unit: string }
): Promise<{ item: ShoppingItemWithIngredient; created: boolean }> {
  // Позиция, уже отмеченная купленной, считается закрытой: новое добавление
  // начинает её заново с этим количеством вместо суммирования поверх уже
  // купленного и снимает отметку "куплено", т.к. появилась новая потребность.
  if (existing.checked) {
    const restarted = await prisma.shoppingItem.update({
      where: { id: existing.id },
      data: { amount: params.amount, unit: params.unit, checked: false },
      include: { ingredient: true },
    });
    return { item: restarted, created: false };
  }

  const mergedAmount =
    existing.amount != null && params.amount != null
      ? round1(existing.amount + params.amount)
      : (existing.amount ?? params.amount);

  const updated = await prisma.shoppingItem.update({
    where: { id: existing.id },
    data: { amount: mergedAmount },
    include: { ingredient: true },
  });
  return { item: updated, created: false };
}

// Один и тот же ингредиент может понадобиться из нескольких блюд (напр. банан
// и в завтраке, и в перекусе) — вместо второй отдельной строки в списке
// покупок количество суммируется в уже существующую позицию по ingredientId.
// Слияние — только при совпадении unit: "1 л" и "1 шт" одного и того же
// названия не одно и то же количество, суммировать их нельзя — это должны
// быть две отдельные позиции.
async function addOrMergeShoppingItem(params: {
  userId: string;
  ingredientId: string;
  category: IngredientCategory;
  amount: number | null;
  unit: string;
  source: ShoppingItemSource;
}): Promise<{ item: ShoppingItemWithIngredient; created: boolean }> {
  const existing = await prisma.shoppingItem.findFirst({
    where: { userId: params.userId, ingredientId: params.ingredientId, unit: params.unit },
    include: { ingredient: true },
  });

  if (!existing) {
    const created = await prisma.shoppingItem.create({
      data: {
        userId: params.userId,
        ingredientId: params.ingredientId,
        category: params.category,
        amount: params.amount,
        unit: params.unit,
        source: params.source,
      },
      include: { ingredient: true },
    });
    return { item: created, created: true };
  }

  return mergeIntoExistingItem(existing, { amount: params.amount, unit: params.unit });
}

// Крайний случай (§6.4, Фаза 3): первый ручной ввод неизвестного ингредиента
// создаёт позицию с ingredientId = null + customName (см. ниже классификацию
// через ИИ). При следующем ручном вводе того же имени matchIngredient уже
// находит категорийный Ingredient, созданный при первом добавлении, и вызов
// пошёл бы по ветке addOrMergeShoppingItem(ingredientId) — но она ищет
// существующую позицию по ingredientId и не увидит "осиротевшую" позицию
// с ingredientId = null, что породило бы дубль строки для того же продукта.
// Решение: перед merge-по-id ищем позицию этого пользователя с
// ingredientId = null, чей customName после нормализации совпадает с именем
// найденного ингредиента, и "привязываем" её (проставляем ingredientId,
// снимаем customName) — дальше она участвует в обычном addOrMergeShoppingItem
// как любая другая привязанная позиция. Привязка идёт только по имени, без
// учёта unit — это про то, что это тот же товар, а не про суммирование
// количества; количество для несовпадающего unit разъедет уже
// addOrMergeShoppingItem, создав для него отдельную позицию.
async function linkOrphanManualItem(userId: string, ingredient: Ingredient): Promise<void> {
  const orphans = await prisma.shoppingItem.findMany({
    where: { userId, ingredientId: null, customName: { not: null } },
  });
  const orphan = orphans.find((o) => normalizeName(o.customName!) === ingredient.nameNormalized);
  if (!orphan) return;

  await prisma.shoppingItem.update({
    where: { id: orphan.id },
    data: { ingredientId: ingredient.id, customName: null, category: ingredient.category },
  });
}

// Создание/слияние позиции для ингредиента, которого ИИ только что
// классифицировал, но который ещё не существует как отдельная запись
// Ingredient в контексте этого запроса (customName остаётся заполнен —
// см. §6.4). Слияние повторного ввода того же ещё-не-связанного имени тоже
// идёт по нормализованному customName (а не по ingredientId, которого нет) —
// и, как и в addOrMergeShoppingItem, только при совпадении unit.
async function addOrMergeManualUnresolvedItem(params: {
  userId: string;
  rawName: string;
  category: IngredientCategory;
  amount: number | null;
  unit: string;
}): Promise<{ item: ShoppingItemWithIngredient; created: boolean }> {
  const normalized = normalizeName(params.rawName);
  const orphans = await prisma.shoppingItem.findMany({
    where: { userId: params.userId, ingredientId: null, customName: { not: null } },
    include: { ingredient: true },
  });
  const existing = orphans.find((o) => normalizeName(o.customName!) === normalized && o.unit === params.unit);

  if (existing) {
    return mergeIntoExistingItem(existing, { amount: params.amount, unit: params.unit });
  }

  const created = await prisma.shoppingItem.create({
    data: {
      userId: params.userId,
      ingredientId: null,
      customName: params.rawName.trim(),
      category: params.category,
      amount: params.amount,
      unit: params.unit,
      source: "MANUAL",
    },
    include: { ingredient: true },
  });
  return { item: created, created: true };
}

const shoppingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/shopping", async (request) => {
    const items = await prisma.shoppingItem.findMany({
      where: { userId: request.userId },
      include: { ingredient: true },
      orderBy: { createdAt: "asc" },
    });

    const byCategory = new Map<string, ShoppingItemWithIngredient[]>();
    for (const item of items) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const groups = CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
      category,
      items: byCategory.get(category)!.map(serializeShoppingItem),
    }));

    return { groups };
  });

  app.post("/api/shopping/item", async (request, reply) => {
    const body = addShoppingItemSchema.parse(request.body);

    if (body.ingredientId) {
      const ingredient = await prisma.ingredient.findUnique({ where: { id: body.ingredientId } });
      if (!ingredient) {
        throw new ApiError(404, "INGREDIENT_NOT_FOUND", "Ингредиент не найден");
      }
      const { item, created } = await addOrMergeShoppingItem({
        userId: request.userId,
        ingredientId: ingredient.id,
        category: ingredient.category,
        amount: body.amount ?? DEFAULT_MANUAL_AMOUNT,
        unit: body.unit?.trim() || ingredient.defaultUnit,
        source: "MANUAL",
      });
      reply.status(created ? 201 : 200);
      return serializeShoppingItem(item);
    }

    // body.name гарантирован схемой (refine: ingredientId либо name).
    const name = body.name!;
    const match = await matchIngredient(name);

    if (match) {
      // Найден в базе (сид-ингредиент или ранее созданный ИИ категорийный) —
      // категория берётся из базы, вызов ИИ не требуется. Перед merge-по-id
      // сначала привязываем "осиротевшую" позицию с ingredientId = null
      // (см. linkOrphanManualItem) — иначе повторный ввод того же имени,
      // который в первый раз ушёл в ИИ-путь, породил бы дубль строки.
      await linkOrphanManualItem(request.userId, match.ingredient);

      const { item, created } = await addOrMergeShoppingItem({
        userId: request.userId,
        ingredientId: match.ingredient.id,
        category: match.ingredient.category,
        amount: body.amount ?? DEFAULT_MANUAL_AMOUNT,
        unit: body.unit?.trim() || match.ingredient.defaultUnit,
        source: "MANUAL",
      });
      reply.status(created ? 201 : 200);
      return serializeShoppingItem(item);
    }

    // Не найден в базе → ИИ-классификация категории (§7.6). AiServiceError
    // означает недоступность/невалидный ответ шлюза — остальной список
    // покупок при этом продолжает работать (§10 «Деградация»), падает только
    // этот конкретный путь, с понятной ошибкой вместо голой 500-ки.
    const normalized = normalizeName(name);
    let category: IngredientCategory;
    try {
      category = await classifyCategory(normalized);
    } catch (err) {
      if (err instanceof AiServiceError) {
        throw new ApiError(
          503,
          "AI_CLASSIFY_UNAVAILABLE",
          `Не удалось определить категорию для «${name}»: сервис ИИ временно недоступен. Попробуйте повторить попытку позже.`
        );
      }
      throw err;
    }

    // Категорийная запись Ingredient (hasNutrition = false, source = AI) —
    // чтобы следующий ввод того же имени нашёлся через matchIngredient и не
    // потребовал повторного вызова ИИ (§6.4). Upsert по уникальному `name`,
    // чтобы повтор/гонка параллельных запросов не падали на unique-constraint.
    // С большой буквы — как и остальные названия в базе (см. capitalizeFirst).
    const displayName = capitalizeFirst(name.trim());
    const unit = body.unit?.trim() || DEFAULT_MANUAL_UNIT;
    await prisma.ingredient.upsert({
      where: { name: displayName },
      create: {
        name: displayName,
        nameNormalized: normalized,
        category,
        hasNutrition: false,
        source: "AI",
        defaultUnit: unit,
      },
      update: {},
    });

    // Сама позиция списка покупок остаётся ingredientId = null + customName
    // (§6.4) — она не привязывается к только что созданному категорийному
    // Ingredient немедленно; связывание происходит при следующем вводе того
    // же имени через linkOrphanManualItem выше.
    const { item, created } = await addOrMergeManualUnresolvedItem({
      userId: request.userId,
      rawName: displayName,
      category,
      amount: body.amount ?? DEFAULT_MANUAL_AMOUNT,
      unit,
    });
    reply.status(created ? 201 : 200);
    return serializeShoppingItem(item);
  });

  app.post("/api/shopping/from-dish/:dishId", async (request) => {
    const { dishId } = dishIdParamSchema.parse(request.params);
    const body = fromDishBodySchema.parse(request.body ?? {});

    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!dish) {
      throw new ApiError(404, "DISH_NOT_FOUND", "Блюдо не найдено");
    }

    const selected =
      body.ingredientIds && body.ingredientIds.length > 0
        ? dish.ingredients.filter((di) => body.ingredientIds!.includes(di.ingredientId))
        : dish.ingredients;

    if (selected.length === 0) {
      throw new ApiError(400, "NO_INGREDIENTS_SELECTED", "Не выбрано ни одного ингредиента блюда");
    }

    const scale = body.scale ?? 1;

    // Через addOrMergeShoppingItem, а не createMany: тот же ингредиент может
    // уже лежать в списке (из другого блюда или добавлен вручную) — нужно
    // суммировать количество в существующую позицию, а не плодить дубликаты
    // строк для одного ingredientId (иначе последующее точечное удаление не
    // сможет однозначно найти "свою" позицию — см. DishCard.tsx/MenuPage.tsx).
    await Promise.all(
      selected.map((di) =>
        addOrMergeShoppingItem({
          userId: request.userId,
          ingredientId: di.ingredientId,
          category: di.ingredient.category,
          amount: round1(di.amount * scale),
          unit: di.unit,
          source: "FROM_DISH",
        })
      )
    );

    return { added: selected.length };
  });

  app.patch("/api/shopping/:id", async (request) => {
    const { id } = shoppingIdParamSchema.parse(request.params);
    const body = patchShoppingItemSchema.parse(request.body);

    const existing = await prisma.shoppingItem.findFirst({ where: { id, userId: request.userId } });
    if (!existing) {
      throw new ApiError(404, "SHOPPING_ITEM_NOT_FOUND", "Позиция списка покупок не найдена");
    }

    const updated = await prisma.shoppingItem.update({
      where: { id },
      data: {
        ...(body.checked !== undefined ? { checked: body.checked } : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
      },
      include: { ingredient: true },
    });

    return serializeShoppingItem(updated);
  });

  app.delete("/api/shopping/:id", async (request) => {
    const { id } = shoppingIdParamSchema.parse(request.params);
    await prisma.shoppingItem.deleteMany({ where: { id, userId: request.userId } });
    return { ok: true };
  });

  app.delete("/api/shopping", async (request) => {
    await prisma.shoppingItem.deleteMany({ where: { userId: request.userId } });
    return { ok: true };
  });
};

export default shoppingRoutes;
